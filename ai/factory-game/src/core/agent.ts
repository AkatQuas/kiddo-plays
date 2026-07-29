// ============================================================
// Agent 助手模块
// 双 Agent 架构：工厂 Agent + 客户 Agent，回合制运行
// 使用 OpenAI 原生 function calling（tools 参数）
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { WorldState, Direction } from "./types.js";
import { getMachine, ITEMS } from "./registry.js";
import { tileKey } from "./world.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', '..', 'data');
let logFile: string;

function ensureLogFile() {
  if (logFile) return;
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  logFile = path.join(LOG_DIR, 'agent.log');
}
function writeLog(tag: string, msg: string) {
  ensureLogFile();
  try { fs.appendFileSync(logFile, '[' + new Date().toISOString() + '] [' + tag + '] ' + msg + '\n'); } catch {}
}

// ============ 世界状态序列化 ============

function serializeState(w: WorldState): string {
  const machines = Object.values(w.tiles).filter(t => t.machineId && !t._ref)
    .map(t => {
      const def = getMachine(t.machineId!);
      const key = Object.entries(w.tiles).find(([k, v]) => v === t)?.[0] || '?';
      return `${key}:${def?.label || t.machineId} facing=${t.facing} progress=${t.progress ?? 'idle'}`;
    }).join('\n');
  const belts = Object.values(w.tiles).filter(t => t.beltDir).length;
  const inv = Object.entries(w.inventory || {}).filter(([_, q]) => q > 0)
    .map(([id, q]) => `${ITEMS[id]?.label || id}:${q}`).join(', ') || '空';
  const orders = (w.orders || []).filter(o => o.status === 'open')
    .map(o => `${JSON.stringify(o.items)} ¥${o.reward} 截止:${o.deadline}`).join('; ') || '无';
  return `tick=${w.tick} 金钱=¥${w.money}\n机器:\n${machines || '无'}\n传送带:${belts}条\n库存:${inv}\n订单:${orders}`;
}

// ============ 执行动作 ============

function executeAction(w: WorldState, action: any, bcast: () => void, onLog: (tag: string, msg: string) => void): string {
  const type = action.action || action.name || action.type;
  if (!type) return '未知动作';

  switch (type) {
    case 'place_machine': {
      const def = getMachine(action.machineId);
      if (!def) return '未知机器';
      const cost = def.cost?.money || 0;
      if (w.money < cost) return '钱不够';
      for (let dy = 0; dy < def.size.h; dy++)
        for (let dx = 0; dx < def.size.w; dx++)
          if (w.tiles[tileKey(action.x + dx, action.y + dy)]) return '位置被占';
      w.money -= cost;
      for (let dy = 0; dy < def.size.h; dy++)
        for (let dx = 0; dx < def.size.w; dx++)
          w.tiles[tileKey(action.x + dx, action.y + dy)] = {
            machineId: action.machineId, facing: (action.facing || 'e') as Direction,
            progress: null, inputBuffer: {}, outputBuffer: {},
            ...(dx === 0 && dy === 0 ? {} : { _ref: `${action.x},${action.y}` }),
          };
      bcast();
      const msg = `🏗️ 放置${def.label} at (${action.x},${action.y}) ¥${cost}`;
      onLog('action', msg);
      writeLog('place', msg);
      return msg;
    }
    case 'place_belt': {
      if ((w.inventory['iron_ore'] || 0) < 8 || (w.inventory['copper_ore'] || 0) < 8) return '材料不够';
      if (w.tiles[tileKey(action.x, action.y)]) return '位置被占';
      w.inventory['iron_ore']! -= 8; w.inventory['copper_ore']! -= 8;
      w.tiles[tileKey(action.x, action.y)] = { beltDir: action.dir as Direction, beltItems: [] };
      bcast();
      const msg = `🔗 传送带 at (${action.x},${action.y}) ${action.dir}`;
      onLog('action', msg);
      writeLog('belt', msg);
      return msg;
    }
    case 'remove_tile': {
      const tile = w.tiles[tileKey(action.x, action.y)];
      if (!tile) return '空';
      if (tile.machineId) {
        const def = getMachine(tile.machineId);
        if (def) {
          let ox = action.x, oy = action.y;
          if (tile._ref) { const [rx, ry] = tile._ref.split(',').map(Number); ox = rx; oy = ry; }
          w.money += Math.floor((def.cost?.money || 0) / 2);
          for (let dy = 0; dy < def.size.h; dy++)
            for (let dx = 0; dx < def.size.w; dx++)
              delete w.tiles[tileKey(ox + dx, oy + dy)];
          bcast();
          return `已回收 ${def.label}`;
        }
      }
      if (tile.beltDir) {
        w.inventory['iron_ore'] = (w.inventory['iron_ore'] || 0) + 8;
        w.inventory['copper_ore'] = (w.inventory['copper_ore'] || 0) + 8;
        delete w.tiles[tileKey(action.x, action.y)]; bcast();
        return '已回收传送带';
      }
      delete w.tiles[tileKey(action.x, action.y)]; bcast();
      return '已回收';
    }
    case 'create_order': {
      w.orders.push({
        id: `order-customer-${Date.now()}`,
        items: action.items, reward: action.reward,
        deadline: w.tick + (action.deadline || 200), status: 'open',
      });
      bcast();
      const msg = `📋 下单 ${JSON.stringify(action.items)} ¥${action.reward}`;
      onLog('action', msg);
      writeLog('order', msg);
      return msg;
    }
    case 'skip':
    case 'think':
      return `⏭️ ${action.reason || '跳过'}`;
    default:
      return `未知动作类型: ${type}`;
  }
}

// ============ Tool 定义（OpenAI Function Calling） ============

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'place_machine',
      description: '放置一台机器。需要指定机器 ID、坐标和朝向。',
      parameters: {
        type: 'object',
        properties: {
          machineId: { type: 'string', description: '机器 ID: miner, copper_miner, furnace, copper_furnace, assembler, beam_press, circuit_assembler, engine_assembler' },
          x: { type: 'number', description: 'X 坐标 (0-23)' },
          y: { type: 'number', description: 'Y 坐标 (0-15)' },
          facing: { type: 'string', enum: ['e', 's', 'w', 'n'], description: '朝向 (默认 e)' },
        },
        required: ['machineId', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_belt',
      description: '放置传送带。消耗 8 铁矿石 + 8 铜矿石。',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X 坐标 (0-23)' },
          y: { type: 'number', description: 'Y 坐标 (0-15)' },
          dir: { type: 'string', enum: ['e', 's', 'w', 'n'], description: '指向方向' },
        },
        required: ['x', 'y', 'dir'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_tile',
      description: '回收一个建筑，返还一半成本。',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skip',
      description: '当前回合不做任何操作。用 reason 说明原因。',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '为什么跳过' },
        },
        required: ['reason'],
      },
    },
  },
];

const CUSTOMER_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: '下订单，指定产品和数量，奖励金额为售价的 2-3 倍。',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'object',
            description: '订单产品，如 {"circuit":5, "engine":2}',
            additionalProperties: { type: 'number' },
          },
          reward: { type: 'number', description: '奖励金额' },
          deadline: { type: 'number', description: '截止 tick，默认 200' },
        },
        required: ['items', 'reward'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skip',
      description: '当前回合不下订单。用 reason 说明原因。',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '为什么跳过' },
        },
        required: ['reason'],
      },
    },
  },
];

// ============ Prompt ============

const FACTORY_PROMPT = `你是一个工厂 AI 管理者。你的目标是扩张工厂、优化生产。

可用的机器及成本：
- miner (¥200) 产铁矿石, 占据 1×1 格
- copper_miner (¥200) 产铜矿石, 1×1
- furnace (¥300) 铁矿石→铁板
- copper_furnace (¥300) 铜矿石→铜板
- assembler (¥500) 铁板→齿轮
- beam_press (¥500) 铁板→铁梁
- circuit_assembler (¥800) 铜板+铁板→电路板
- engine_assembler (¥1000) 齿轮+铁梁→引擎
- 传送带: 消耗 8 铁矿石+8 铜矿石

可用工具：
- place_machine: 放置机器
- place_belt: 放传送带
- remove_tile: 回收建筑（返还一半成本）。如果位置被占，先拆再建！
- skip: 无事可做时调用

规则：
1. 一次可以调用多个工具，比如先拆再建
2. 如果位置被占，先 remove_tile 再 place_machine
3. 机器不要重叠，注意金钱和库存
4. 如果无事可做或暂时等待，调用 skip`;

const CUSTOMER_PROMPT = `你是一个外部客户，向工厂下订单。

可销售：circuit(¥35), engine(¥80), electronic(¥50)
奖励金额 = 售价 × 2~3 倍
截止 tick 设为 200~300

规则：
1. 每次只下一个订单
2. 如果工厂资源不足，调用 skip`;

// ============ API 调用 ============

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: (process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '') + '/',
  });
}

async function callLLMWithTools(
  messages: any[],
  tools: OpenAI.Chat.Completions.ChatCompletionTool[],
  forceTool?: string,
): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
  const client = getClient();
  const modelId = process.env.OPENAI_MODEL || 'deepseek-v4-flash';
  const params: any = {
    model: modelId,
    messages,
    tools,
    tool_choice: forceTool || 'required',
    max_tokens: 200,
    temperature: 0.7,
  };
  const res = await client.chat.completions.create(params);
  return res.choices?.[0]?.message || { role: 'assistant' as const, content: '' };
}

// ============ Agent 执行器 ============

async function runAgent(
  w: () => WorldState,
  systemPrompt: string,
  stateText: string,
  bcast: () => void,
  onLog: (tag: string, msg: string) => void,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[],
  isCustomer: boolean,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { onLog('system', '⚠️ 未配置 API Key'); return; }

  ensureLogFile();
  writeLog('turn', (isCustomer ? '客户' : '工厂') + ' tick=' + w().tick);

  try {
    // 如果世界已暂停，不执行
    if (w().paused) {
      onLog('text', '⏸️ 游戏已暂停，跳过本回合');
      writeLog('skip', 'paused');
      onLog('system', '✅ 完成');
      return;
    }
    onLog('system', '🤖 思考中...');

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `当前状态:
${stateText}` },
    ];

    const MAX_TURNS = 1;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const msg = await callLLMWithTools(messages, tools);
      messages.push(msg);

      const toolCalls = msg.tool_calls;

      // 没有 tool call → 结束
      if (!toolCalls || toolCalls.length === 0) {
        break;
      }

      // 处理所有的 tool calls
      for (const rawCall of toolCalls) {
        const call = rawCall as any;
        const args = JSON.parse(call.function?.arguments || '{}');
        args.action = call.function?.name || call.name;
        executeAction(w(), args, bcast, onLog);
      }
    }
    onLog('system', '✅ 完成');
  } catch (err: any) {
    onLog('error', `❌ ${err?.message || String(err)}`);
    writeLog('error', err?.message || String(err));
  }
}

/** 运行工厂 Agent */
export async function runFactoryAgent(
  worldRef: { current: WorldState },
  broadcast: () => void,
  onLog: (tag: string, msg: string) => void,
) {
  const w = () => worldRef.current;
  const stateText = serializeState(w());
  await runAgent(w, FACTORY_PROMPT, stateText, broadcast, onLog, TOOLS, false);
  broadcast();
}

/** 运行客户 Agent */
export async function runCustomerAgent(
  worldRef: { current: WorldState },
  broadcast: () => void,
  onLog: (tag: string, msg: string) => void,
) {
  const w = () => worldRef.current;
  const stateText = serializeState(w());
  await runAgent(w, CUSTOMER_PROMPT, stateText, broadcast, onLog, CUSTOMER_TOOLS, true);
  broadcast();
}

/** 人类玩家手动查询 */
export async function queryAgent(
  worldRef: { current: WorldState },
  text: string,
  broadcast: () => void,
): Promise<{ type: string; icon: string; title: string; body: string }[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [{ type: 'answer', icon: '🤖', title: '提示', body: '未配置 API Key' }];
  try {
    const client = getClient();
    const modelId = process.env.OPENAI_MODEL || 'deepseek-v4-flash';
    const res = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: FACTORY_PROMPT },
        { role: 'user', content: `当前状态:\n${serializeState(worldRef.current)}\n\n${text}` },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });
    const content = res.choices?.[0]?.message?.content || '';
    return [{ type: 'answer', icon: '🤖', title: 'Agent 回复', body: content }];
  } catch (err: any) {
    return [{ type: 'alert', icon: '⚠️', title: 'Agent 出错', body: err?.message || String(err) }];
  }
}
