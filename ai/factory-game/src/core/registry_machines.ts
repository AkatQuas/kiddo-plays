import { MachineDef } from './types.js';
export const MACHINES: Record<string, MachineDef> = {
  miner: {
    name: 'miner', label: '采矿机', size: { w: 1, h: 1 },
    color: '#666666', icon: '⛏',
    powerDraw: 3, naturalResource: 'iron_ore',
    cost: { money: 200 },
  },
  copper_miner: {
    name: 'copper_miner', label: '铜矿机', size: { w: 1, h: 1 },
    color: '#B87333', icon: '⛏',
    powerDraw: 3, naturalResource: 'copper_ore',
    cost: { money: 200 },
  },
  furnace: {
    name: 'furnace', label: '熔炉', size: { w: 2, h: 1 },
    color: '#CC6633', icon: '🔥',
    powerDraw: 5,
    recipe: { inputs: [{ item: 'iron_ore', qty: 2 }], outputs: [{ item: 'iron_plate', qty: 1 }], time: 3 },
    cost: { money: 300 },
  },
  copper_furnace: {
    name: 'copper_furnace', label: '铜熔炉', size: { w: 2, h: 1 },
    color: '#D4A574', icon: '🔥',
    powerDraw: 5,
    recipe: { inputs: [{ item: 'copper_ore', qty: 2 }], outputs: [{ item: 'copper_plate', qty: 1 }], time: 3 },
    cost: { money: 300 },
  },
  assembler: {
    name: 'assembler', label: '组装机', size: { w: 2, h: 2 },
    color: '#4488CC', icon: '⚙',
    powerDraw: 8,
    recipe: { inputs: [{ item: 'iron_plate', qty: 2 }], outputs: [{ item: 'gear', qty: 1 }], time: 2 },
    cost: { money: 500 },
  },
  beam_press: {
    name: 'beam_press', label: '冲压机', size: { w: 2, h: 2 },
    color: '#8866AA', icon: '⬜',
    powerDraw: 6,
    recipe: { inputs: [{ item: 'iron_plate', qty: 3 }], outputs: [{ item: 'iron_beam', qty: 1 }], time: 3 },
    cost: { money: 500 },
  },
  circuit_assembler: {
    name: 'circuit_assembler', label: '电路装配机', size: { w: 2, h: 2 },
    color: '#22AA44', icon: '🔬',
    powerDraw: 10,
    recipe: { inputs: [{ item: 'copper_plate', qty: 2 }, { item: 'iron_plate', qty: 1 }], outputs: [{ item: 'circuit', qty: 1 }], time: 4 },
    cost: { money: 800 },
  },
  engine_assembler: {
    name: 'engine_assembler', label: '引擎装配机', size: { w: 2, h: 2 },
    color: '#CC4444', icon: '🚀',
    powerDraw: 15,
    recipe: { inputs: [{ item: 'gear', qty: 2 }, { item: 'iron_beam', qty: 1 }], outputs: [{ item: 'engine', qty: 1 }], time: 6 },
    cost: { money: 1000 },
  },
};
