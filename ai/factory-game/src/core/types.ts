// ============================================================
// 游戏核心类型定义
// ============================================================

export type Direction = 'n' | 's' | 'e' | 'w';

/** 传送带上的一堆物品 */
export interface BeltItem {
  itemId: string;
  qty: number;
  progress: number; // 0→1，到 1 则进入下一格
}

export interface TileData {
  // ——— 机器 ———
  machineId?: string;
  facing?: Direction;       // 输出方向
  progress?: number | null; // 加工进度 0→1，null=空闲
  inputBuffer?: Record<string, number>;  // itemId → qty
  outputBuffer?: Record<string, number>;

  // ——— 传送带 ———
  beltDir?: Direction | null;
  beltEntry?: Direction | null;   // 弯头传送带：物品进入方向
  beltItems?: BeltItem[];

  // ——— 采矿机专属：矿脉类型 ———
  resourceId?: string;

  // ——— 多格机器的子格引用（不上客户端） ———
  _ref?: string;
}

/** 世界状态（纯 JSON，可直接序列化存 SQLite） */
export interface WorldState {
  tick: number;
  money: number;
  width: number;
  height: number;
  tiles: Record<string, TileData>;
  inventory: Record<string, number>;  // 全局库存（备用）
  orders: OrderData[];
  stats: StatsData;
  speed: number;    // tick/秒
  paused: boolean;
}

export interface OrderData {
  id: string;
  items: Record<string, number>;
  reward: number;
  deadline: number;
  status: 'open' | 'fulfilled' | 'expired';
}

export interface StatsData {
  totalItemsProduced: Record<string, number>;
  totalMoneyEarned: number;
}

// ========== 注册表（静态，存于 registry.ts） ==========

/** 物品定义 */
export interface ItemDef {
  name: string;
  label: string;
  color: string;
  stackSize: number;
  sellPrice?: number; // 自动售卖单价
}

/** 配方（入→出） */
export interface RecipeDef {
  inputs?: { item: string; qty: number }[];
  outputs: { item: string; qty: number }[];
  time: number; // 加工耗时（tick 数）
}

/** 机器定义 */
export interface MachineDef {
  name: string;
  label: string;
  size: { w: number; h: number };
  recipe?: RecipeDef | RecipeDef[];
  powerDraw: number;
  color: string;
  icon: string;
  naturalResource?: string;
  /** 建造成本：金钱（机器）或物品（传送带） */
  cost?: { money?: number; items?: { item: string; qty: number }[] };
}

/** 组件面板分类 */
export interface BuildCategoryDef {
  label: string;
  items: string[]; // machineId 列表
}

// ========== 客户端消息 ==========

export type ClientMsg =
  | { type: 'place_machine'; x: number; y: number; machineId: string; facing: Direction }
  | { type: 'place_belt'; x: number; y: number; dir: Direction; beltEntry?: Direction }
  | { type: 'remove_tile'; x: number; y: number }
  | { type: 'set_speed'; speed: number }
  | { type: 'toggle_pause' }
  | { type: 'reset' }
  | { type: 'agent_query'; text: string }
  | { type: 'place_preset'; presetId: string; x: number; y: number; };
export type ServerMsg =
  | { type: 'state'; world: WorldState }
  | { type: 'agent_reply'; cards: AgentCard[] }
  | { type: 'agent_log'; tag: string; msg: string };

export interface AgentCard {
  type: 'alert' | 'suggestion' | 'answer';
  icon: string;
  title: string;
  body: string;
  actions?: { label: string; action: string }[];
}
