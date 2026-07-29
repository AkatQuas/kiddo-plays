// ============================================================
// 订单系统：自动生成订单，满足条件得金币
// ============================================================

import { WorldState, OrderData } from './types.js';
import { ITEMS } from './registry.js';

let orderIdCounter = 0;

/** 每 N tick 尝试生成一个新订单 */
const ORDER_INTERVAL = 30;
/** 订单过期 tick 数 */
const ORDER_EXPIRY = 200;
/** 最大同时存在的订单数 */
const MAX_ORDERS = 4;

/** 只在成品（有 sellPrice 的）里选 */
function getSellableItems(): { name: string; label: string; price: number }[] {
  const out: { name: string; label: string; price: number }[] = [];
  for (const [name, def] of Object.entries(ITEMS)) {
    if (def.sellPrice) {
      out.push({ name, label: def.label, price: def.sellPrice });
    }
  }
  return out;
}

function generateOrder(world: WorldState): OrderData | null {
  const sellable = getSellableItems();
  if (!sellable.length) return null;

  // 排除玩家已有大量库存的成品，倾向让玩家造新东西
  const item = sellable[Math.floor(Math.random() * sellable.length)];
  const qty = 3 + Math.floor(Math.random() * 8); // 3~10 个
  const reward = item.price * qty * 2; // 售价的 2 倍作为奖励
  orderIdCounter++;

  return {
    id: `order-${orderIdCounter}`,
    items: { [item.name]: qty },
    reward,
    deadline: world.tick + ORDER_EXPIRY,
    status: 'open',
  };
}

/** 每 tick 调用：生成 + 过期 + 完成检查 */
export function processOrders(world: WorldState): { moneyEarned: number; fulfilled: string[] } {
  const fulfilled: string[] = [];
  let moneyEarned = 0;

  // 1) 生成新订单
  if (world.tick > 0 && world.tick % ORDER_INTERVAL === 0) {
    const open = (world.orders || []).filter((o) => o.status === 'open').length;
    if (open < MAX_ORDERS) {
      const order = generateOrder(world);
      if (order) world.orders.push(order);
    }
  }

  // 2) 检查过期 & 完成
  const remaining: OrderData[] = [];
  for (const order of world.orders) {
    if (order.status !== 'open') {
      if (order.status === 'fulfilled' || order.status === 'expired') continue;
      remaining.push(order);
      continue;
    }

    // 过期
    if (world.tick > order.deadline) {
      order.status = 'expired';
      continue;
    }

    // 检查库存是否满足
    let canFulfill = true;
    for (const [itemId, qty] of Object.entries(order.items)) {
      const have = world.inventory[itemId] || 0;
      if (have < qty) { canFulfill = false; break; }
    }

    if (canFulfill) {
      // 扣库存
      for (const [itemId, qty] of Object.entries(order.items)) {
        world.inventory[itemId] = (world.inventory[itemId] || 0) - qty;
      }
      order.status = 'fulfilled';
      world.money += order.reward;
      world.stats.totalMoneyEarned += order.reward;
      moneyEarned += order.reward;
      fulfilled.push(order.id);
    } else {
      remaining.push(order);
    }
  }

  // 清理已完成的订单（保留最近几条用于展示）
  const done = world.orders.filter((o) => o.status === 'fulfilled' || o.status === 'expired');
  if (done.length > 10) {
    world.orders = remaining.concat(done.slice(-10));
  } else {
    world.orders = remaining.concat(done);
  }

  return { moneyEarned, fulfilled };
}
