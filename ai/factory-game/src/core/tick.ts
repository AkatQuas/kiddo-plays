// ============================================================
// 游戏主循环：tick pipeline
// 每 tick 执行：采矿 → 加工 → 传送带运输 → 输出推送 → 自动售卖
// ============================================================

import { WorldState, TileData, MachineDef, RecipeDef } from './types.js';
import { MACHINES, ITEMS, getMachine } from './registry.js';
import { tileKey, neighborFromKey, getTile, getNeighbor } from './world.js';
import { processOrders } from './orders.js';

const BELT_SPEED = 0.25; // 每 tick 前进 1/4 格，4 tick 走完一格

// ============ 主入口 ============

export function tickWorld(world: WorldState): WorldState {
  if (world.paused) return world;

  world.tick++;

  // 阶段 1：机器加工（采矿 + 配方）
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (!tile.machineId) continue;
    if (tile._ref) continue; // 多格机器只处理主格
    const def = getMachine(tile.machineId);
    if (!def) continue;
    processMachine(world, key, tile, def);
  }

  // 阶段 2：传送带移动
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (!tile.beltDir) continue;
    moveBeltItems(world, key, tile);
  }

  // 阶段 3：机器输出 → 相邻传送带 / 机器
  for (const [key, tile] of Object.entries(world.tiles)) {
    if (!tile.machineId) continue;
    if (!tile.outputBuffer || Object.keys(tile.outputBuffer).length === 0) continue;
    const def = getMachine(tile.machineId);
    if (!def) continue;
    if (def.naturalResource) continue; // 采矿机输出由 processMachine 直接推
    ejectOutput(world, key, tile, def);
  }

  // 阶段 4：订单检查
  processOrders(world);

  return world;
}

// ============ 阶段 1：机器加工 ============

function processMachine(world: WorldState, key: string, tile: TileData, def: MachineDef) {
  // 采矿机：无配方，自然产出
  if (def.naturalResource) {
    if (!tile.outputBuffer) tile.outputBuffer = {};
    // 每 tick 产出 1 个（暂不考虑速度倍率）
    tile.outputBuffer[def.naturalResource] = (tile.outputBuffer[def.naturalResource] || 0) + 1;
    // 记入库存
    world.inventory[def.naturalResource] = (world.inventory[def.naturalResource] || 0) + 1;
    // 推给相邻传送带
    pushToAdjacent(world, key, tile, def.naturalResource, 1);
    recordStats(world, def.naturalResource, 1);
    return;
  }

  // 有配方的机器
  const recipe = Array.isArray(def.recipe) ? def.recipe[0] : def.recipe;
  if (!recipe) return;

  if (tile.progress == null) {
    // 检查输入是否足够，开始加工
    if (!canStart(recipe, tile)) return;
    consumeInput(recipe, tile);
    tile.progress = 0;
  }

  // 推进进度
  tile.progress! += 1 / recipe.time;

  if (tile.progress! >= 1) {
    tile.progress = null;
    // 产出
    if (!tile.outputBuffer) tile.outputBuffer = {};
    for (const out of recipe.outputs) {
      tile.outputBuffer![out.item] = (tile.outputBuffer![out.item] || 0) + out.qty;
      // 产出同时记入库存（中间产物也追踪数量）
      world.inventory[out.item] = (world.inventory[out.item] || 0) + out.qty;
      recordStats(world, out.item, out.qty);
    }
  }
}

function canStart(recipe: RecipeDef, tile: TileData): boolean {
  if (!recipe.inputs || recipe.inputs.length === 0) return true;
  const buf = tile.inputBuffer || {};
  return recipe.inputs.every(inp => (buf[inp.item] || 0) >= inp.qty);
}

function consumeInput(recipe: RecipeDef, tile: TileData) {
  if (!recipe.inputs) return;
  for (const inp of recipe.inputs) {
    if (!tile.inputBuffer) tile.inputBuffer = {};
    tile.inputBuffer[inp.item] = (tile.inputBuffer[inp.item] || 0) - inp.qty;
  }
}

// ============ 阶段 2：传送带 ============

function moveBeltItems(world: WorldState, key: string, tile: TileData) {
  const items = tile.beltItems;
  if (!items || items.length === 0) return;

  const dir = tile.beltDir!;
  const arrived: typeof items = [];

  // 推进所有物品
  for (const item of items) {
    item.progress += BELT_SPEED;
    if (item.progress >= 1) arrived.push(item);
  }
  tile.beltItems = items.filter(item => item.progress < 1);

  // 处理到达终点的物品
  for (const item of arrived) {
    const n = neighborFromKey(key, dir);
    const nk = tileKey(n.x, n.y);
    deliverItem(world, nk, item.itemId, item.qty);
  }
}

/** 把物品送到下一格 */
function deliverItem(world: WorldState, key: string, itemId: string, qty: number) {
  const [x, y] = key.split(',').map(Number);
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) {
    // 超出地图 → 自动售卖
    sellItem(world, itemId, qty);
    return;
  }

  const tile = world.tiles[key];
  if (!tile) {
    sellItem(world, itemId, qty);
    return;
  }
  // 多格机器的子格 → 转到主格
  if (tile._ref) {
    deliverItem(world, tile._ref, itemId, qty);
    return;
  }

  // 传送带
  if (tile.beltDir) {
    tile.beltItems = tile.beltItems || [];
    tile.beltItems.push({ itemId, qty, progress: 0 });
    return;
  }

  // 机器输入
  if (tile.machineId) {
    tile.inputBuffer = tile.inputBuffer || {};
    tile.inputBuffer[itemId] = (tile.inputBuffer[itemId] || 0) + qty;
    return;
  }

  // 其他情况 → 售卖
  sellItem(world, itemId, qty);
}

// ============ 阶段 3：机器输出推送 ============

function ejectOutput(world: WorldState, key: string, tile: TileData, def: MachineDef) {
  if (!tile.outputBuffer) return;
  const dir = tile.facing || 'e';
  // 计算输出位置：多格机器从占地面积的最远格输出
  const [x, y] = key.split(',').map(Number);
  let exitX = x, exitY = y;
  if (dir === 'e') exitX = x + def.size.w - 1;
  if (dir === 's') exitY = y + def.size.h - 1;
  const exitKey = tileKey(exitX, exitY);
  for (const [itemId, qty] of Object.entries(tile.outputBuffer)) {
    if (qty <= 0) continue;
    pushToAdjacent(world, exitKey, tile, itemId, qty);
    tile.outputBuffer[itemId] = 0;
  }
}

function pushToAdjacent(world: WorldState, key: string, tile: TileData, itemId: string, qty: number) {
  const dir = tile.facing || 'e';
  // 先推给相邻瓦片
  const n = neighborFromKey(key, dir);
  const nk = tileKey(n.x, n.y);
  deliverItem(world, nk, itemId, qty);
}

// ============ 售卖 ============

function sellItem(world: WorldState, itemId: string, qty: number) {
  const def = ITEMS[itemId];
  if (!def) return;
  // 所有物品都进库存，由订单系统处理金币
  world.inventory[itemId] = (world.inventory[itemId] || 0) + qty;
  world.stats.totalItemsProduced[itemId] = (world.stats.totalItemsProduced[itemId] || 0) + qty;
}

function recordStats(world: WorldState, itemId: string, qty: number) {
  world.stats.totalItemsProduced[itemId] = (world.stats.totalItemsProduced[itemId] || 0) + qty;
}