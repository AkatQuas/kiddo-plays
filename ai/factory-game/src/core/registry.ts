// ============================================================
// 元数据内核：物品 / 机器 / 配方 / 建造面板 注册表
// 思路：跟 ERP 的 ENTITIES 一样，声明式定义，消费方反射读取
// ============================================================

import { ItemDef, MachineDef, BuildCategoryDef } from './types.js';
import { MACHINES } from './registry_machines.js';  // 机器定义带成本

// ──── 物品 ────

export const ITEMS: Record<string, ItemDef> = {
  // ── 原料（无 sellPrice = 不能卖钱，只计数量）──
  iron_ore:     { name: 'iron_ore',     label: '铁矿石', color: '#8B7355', stackSize: 100 },
  copper_ore:   { name: 'copper_ore',   label: '铜矿石', color: '#B87333', stackSize: 100 },

  // ── 中间产物（不卖钱，只计数量）──
  iron_plate:   { name: 'iron_plate',   label: '铁板',   color: '#C0C0C0', stackSize: 50 },
  copper_plate: { name: 'copper_plate', label: '铜板',   color: '#D4A574', stackSize: 50 },
  gear:         { name: 'gear',         label: '齿轮',   color: '#808080', stackSize: 30 },
  iron_beam:    { name: 'iron_beam',    label: '铁梁',   color: '#A0A0A0', stackSize: 30 },

  // ── 成品（可卖钱）──
  circuit:      { name: 'circuit',      label: '电路板', color: '#00AA00', stackSize: 30,  sellPrice: 35 },
  engine:       { name: 'engine',       label: '引擎',   color: '#FF4444', stackSize: 10,  sellPrice: 80 },
  electronic:   { name: 'electronic',   label: '电子元件', color: '#FFD700', stackSize: 20, sellPrice: 50 },
};

// ──── 机器定义（从 registry_machines.ts 导入）──
export { MACHINES } from './registry_machines.js';

// ──── 建造面板分类 ────

export const BUILD_CATEGORIES: BuildCategoryDef[] = [
  { label: '⚡ 基础生产', items: ['miner', 'copper_miner', 'furnace', 'copper_furnace'] },
  { label: '🏭 高级加工', items: ['assembler', 'beam_press', 'circuit_assembler', 'engine_assembler'] },
];

// 辅助函数

export function getMachine(id: string): MachineDef | undefined {
  return MACHINES[id];
}

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

/** 返回所有可作为矿脉的机器 */
export function getNaturalResources(): { machineId: string; itemId: string }[] {
  const out: { machineId: string; itemId: string }[] = [];
  for (const [id, m] of Object.entries(MACHINES)) {
    if (m.naturalResource) out.push({ machineId: id, itemId: m.naturalResource });
  }
  return out;
}