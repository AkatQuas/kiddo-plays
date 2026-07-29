// ============================================================
// 世界状态工厂：创建初始世界 + 辅助函数
// ============================================================

import { WorldState, TileData } from './types.js';
import { getNaturalResources } from './registry.js';

const DEFAULT_W = 24;
const DEFAULT_H = 16;

export function createWorld(width = DEFAULT_W, height = DEFAULT_H): WorldState {
  const tiles: Record<string, TileData> = {};

  // 生成矿脉（固定位置，方便教学）
  const resources = getNaturalResources();
  const veins: { x: number; y: number; machineId: string; itemId: string }[] = [
    { x: 3, y: 3, machineId: 'miner', itemId: 'iron_ore' },
    { x: 3, y: 6, machineId: 'copper_miner', itemId: 'copper_ore' },
  ];

  for (const v of veins) {
    const key = tileKey(v.x, v.y);
    tiles[key] = {
      machineId: v.machineId,
      facing: 'e',
      progress: null,
      inputBuffer: {},
      outputBuffer: {},
      resourceId: v.itemId,
    };
  }

  return {
    tick: 0,
    money: 5000,
    width,
    height,
    tiles,
    inventory: { iron_ore: 40, copper_ore: 40 },
    orders: [],
    stats: {
      totalItemsProduced: {},
      totalMoneyEarned: 0,
    },
    speed: 2,
    paused: false,
  };
}

/** 把 2D 坐标转成 key */
export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** 取得相邻方向的目标坐标 */
export function neighbor(x: number, y: number, dir: 'n' | 's' | 'e' | 'w'): { x: number; y: number } {
  switch (dir) {
    case 'n': return { x, y: y - 1 };
    case 's': return { x, y: y + 1 };
    case 'e': return { x: x + 1, y };
    case 'w': return { x: x - 1, y };
  }
}

/** 反方向 */
export function oppositeDir(dir: 'n' | 's' | 'e' | 'w'): 'n' | 's' | 'e' | 'w' {
  return ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[dir];
}
/** 从 key 获取相邻方向的目标坐标 */
export function neighborFromKey(key: string, dir: 'n' | 's' | 'e' | 'w'): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number);
  return neighbor(x, y, dir);
}

/** 获取瓦片，不存在返回空对象 */
export function getTile(world: WorldState, x: number, y: number): TileData | undefined {
  return world.tiles[tileKey(x, y)];
}

/** 获取相邻瓦片 */
export function getNeighbor(world: WorldState, x: number, y: number, dir: 'n' | 's' | 'e' | 'w'): TileData | undefined {
  const n = neighbor(x, y, dir);
  return getTile(world, n.x, n.y);
}
