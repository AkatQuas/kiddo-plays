// ============================================================
// 游戏主入口：Express + WebSocket + 游戏主循环
// ============================================================

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WorldState, ClientMsg, ServerMsg, TileData } from './core/types.js';
import { getMachine, BUILD_CATEGORIES, ITEMS, MACHINES } from './core/registry.js';
import { tickWorld } from './core/tick.js';
import { tileKey, createWorld } from './core/world.js';
import { initDB, saveWorld, loadOrCreateWorld, closeDB, resetDB } from './core/db.js';
import { queryAgent, runFactoryAgent, runCustomerAgent } from './core/agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

// ──── 状态 ────
let world: WorldState;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const TICK_MS = 1000;

// ──── 初始化 ────
initDB();
world = loadOrCreateWorld();

// ──── Express ────
const app = express();
app.use(express.static(PUBLIC));

const PRESETS = [
  {
    id: 'iron_line',
    label: '基础铁板线',
    cost: { money: 500, items: { iron_ore: 8, copper_ore: 8 } },
    parts: [
      { type: 'machine', dx: 0, dy: 0, machineId: 'miner', facing: 'e' },
      { type: 'belt', dx: 1, dy: 0, dir: 'e' },
      { type: 'belt', dx: 2, dy: 0, dir: 'e' },
      { type: 'machine', dx: 3, dy: 0, machineId: 'furnace', facing: 'e' },
    ],
  },
  {
    id: 'copper_line',
    label: '基础铜板线',
    cost: { money: 500, items: { iron_ore: 8, copper_ore: 8 } },
    parts: [
      { type: 'machine', dx: 0, dy: 0, machineId: 'copper_miner', facing: 'e' },
      { type: 'belt', dx: 1, dy: 0, dir: 'e' },
      { type: 'belt', dx: 2, dy: 0, dir: 'e' },
      { type: 'machine', dx: 3, dy: 0, machineId: 'copper_furnace', facing: 'e' },
    ],
  },
  {
    id: 'circuit_line',
    label: '电路板产线',
    desc: '需要铁矿+铜矿机同时运作，产出电路板',
    cost: { money: 1300, items: { iron_ore: 32, copper_ore: 32 } },
    parts: [
      { type: 'machine', dx: 0, dy: 0, machineId: 'miner', facing: 'e' },
      { type: 'machine', dx: 0, dy: 3, machineId: 'copper_miner', facing: 'e' },
      { type: 'belt', dx: 1, dy: 0, dir: 'e' },
      { type: 'belt', dx: 2, dy: 0, dir: 'e' },
      { type: 'machine', dx: 3, dy: 0, machineId: 'furnace', facing: 'e' },
      { type: 'belt', dx: 5, dy: 0, dir: 's' },
      { type: 'belt', dx: 5, dy: 1, dir: 's' },
      { type: 'belt', dx: 5, dy: 2, dir: 'e' },
      { type: 'belt', dx: 6, dy: 2, dir: 'e' },
      { type: 'belt', dx: 1, dy: 3, dir: 'e' },
      { type: 'belt', dx: 2, dy: 3, dir: 'e' },
      { type: 'machine', dx: 3, dy: 3, machineId: 'copper_furnace', facing: 'e' },
      { type: 'belt', dx: 5, dy: 3, dir: 'e' },
      { type: 'belt', dx: 6, dy: 3, dir: 'e' },
      { type: 'machine', dx: 7, dy: 2, machineId: 'circuit_assembler', facing: 'e' },
    ],
  },
];

/** 获取预设清单（不含机器引用） */
app.get('/api/presets', (_req, res) => {
  res.json(PRESETS.map(p => ({ id: p.id, label: p.label, desc: p.desc, cost: p.cost })));
});

// 游戏元信息 API
app.get('/api/meta', (_req, res) => {
  res.json({
    width: world.width,
    height: world.height,
    items: ITEMS,
    machines: MACHINES,
    categories: BUILD_CATEGORIES,
  });
});

// ──── WebSocket ────
const server = createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  socket.emit('message', JSON.stringify({ type: 'state', world }));

  socket.on('message', (raw: string) => {
    try {
      const msg: ClientMsg = JSON.parse(raw);
      handleMessage(socket, msg);
    } catch (e) {
      console.error('  消息解析失败:', e);
    }
  });
});

function broadcast(msg: ServerMsg) {
  io.emit("message", JSON.stringify(msg));
}

// ──── 消息处理 ────
function handleMessage(socket: any, msg: ClientMsg) {
  switch (msg.type) {
    case 'place_machine':
      handlePlaceMachine(msg.x, msg.y, msg.machineId, msg.facing);
      break;
    case 'place_belt':
      handlePlaceBelt(msg.x, msg.y, msg.dir, (msg as any).beltEntry);
      break;
    case 'remove_tile':
      handleRemoveTile(msg.x, msg.y);
      break;
    case 'set_speed':
      world.speed = Math.max(0.5, Math.min(10, msg.speed));
      restartTickLoop();
      break;
    case 'toggle_pause':
      world.paused = !world.paused;
      broadcast({ type: 'state', world });
      break;
    case 'reset':
      resetGame();
      break;
    case 'agent_query':
      handleAgentQuery(socket, msg.text);
      break;
    case 'place_preset':
      handlePlacePreset(msg.presetId, msg.x, msg.y);
      break;
  }
}

// ──── 放置逻辑 ────
function handlePlaceMachine(x: number, y: number, machineId: string, facing: string) {
  const def = getMachine(machineId);
  if (!def) return;
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) return;
  const cost = def.cost?.money || 0;
  if (world.money < cost) return;
  for (let dy = 0; dy < def.size.h; dy++)
    for (let dx = 0; dx < def.size.w; dx++)
      if (world.tiles[tileKey(x + dx, y + dy)]) return;
  world.money -= cost;
  for (let dy = 0; dy < def.size.h; dy++)
    for (let dx = 0; dx < def.size.w; dx++)
      world.tiles[tileKey(x + dx, y + dy)] = {
        machineId, facing: facing as any, progress: null, inputBuffer: {}, outputBuffer: {},
        ...(dx === 0 && dy === 0 ? {} : { _ref: `${x},${y}` }),
      };
  broadcast({ type: 'state', world });
}

function handlePlaceBelt(x: number, y: number, dir: string, beltEntry?: string) {
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) return;
  const key = tileKey(x, y);
  if (world.tiles[key]) return;
  const cost = 8;
  const haveFe = world.inventory['iron_ore'] || 0;
  const haveCu = world.inventory['copper_ore'] || 0;
  if (haveFe < cost || haveCu < cost) return;
  world.inventory['iron_ore'] = haveFe - cost;
  world.inventory['copper_ore'] = haveCu - cost;
  const tile: any = { beltDir: dir as any, beltItems: [] };
  if (beltEntry) tile.beltEntry = beltEntry as any;
  world.tiles[key] = tile;
  broadcast({ type: 'state', world });
}

function handleRemoveTile(x: number, y: number) {
  const key = tileKey(x, y);
  const tile = world.tiles[key];
  if (!tile) return;
  if (tile.machineId) {
    const def = getMachine(tile.machineId);
    if (def) {
      let ox = x, oy = y;
      if (tile._ref) { const [rx, ry] = tile._ref.split(',').map(Number); ox = rx; oy = ry; }
      const refund = Math.floor((def.cost?.money || 0) / 2);
      world.money += refund;
      for (let dy = 0; dy < def.size.h; dy++)
        for (let dx = 0; dx < def.size.w; dx++)
          delete world.tiles[tileKey(ox + dx, oy + dy)];
    } else {
      delete world.tiles[key];
    }
  } else if (tile.beltDir) {
    world.inventory['iron_ore'] = (world.inventory['iron_ore'] || 0) + 8;
    world.inventory['copper_ore'] = (world.inventory['copper_ore'] || 0) + 8;
    delete world.tiles[key];
  } else {
    delete world.tiles[key];
  }
  broadcast({ type: 'state', world });
}

function handlePlacePreset(presetId: string, ox: number, oy: number) {
  const preset = PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  if (world.money < preset.cost.money) return;
  const needFe = preset.cost.items?.iron_ore || 0;
  const needCu = preset.cost.items?.copper_ore || 0;
  if ((world.inventory['iron_ore'] || 0) < needFe) return;
  if ((world.inventory['copper_ore'] || 0) < needCu) return;
  for (const p of preset.parts) {
    const x = ox + p.dx, y = oy + p.dy;
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return;
    if (p.type === 'machine') {
      const def = getMachine(p.machineId!);
      if (!def) return;
      for (let dy = 0; dy < def.size.h; dy++)
        for (let dx = 0; dx < def.size.w; dx++)
          if (world.tiles[tileKey(x + dx, y + dy)]) return;
    } else {
      if (world.tiles[tileKey(x, y)]) return;
    }
  }
  world.money -= preset.cost.money;
  world.inventory['iron_ore'] = (world.inventory['iron_ore'] || 0) - needFe;
  world.inventory['copper_ore'] = (world.inventory['copper_ore'] || 0) - needCu;
  for (const p of preset.parts) {
    const x = ox + p.dx, y = oy + p.dy;
    if (p.type === 'machine') {
      const def = getMachine(p.machineId!);
      if (!def) continue;
      for (let dy = 0; dy < def.size.h; dy++)
        for (let dx = 0; dx < def.size.w; dx++)
          world.tiles[tileKey(x + dx, y + dy)] = {
            machineId: p.machineId, facing: p.facing as any,
            progress: null, inputBuffer: {}, outputBuffer: {},
            ...(dx === 0 && dy === 0 ? {} : { _ref: `${x},${y}` }),
          } as any;
    } else {
      world.tiles[tileKey(x, y)] = { beltDir: p.dir as any, beltItems: [] };
    }
  }
  broadcast({ type: 'state', world });
}

async function handleAgentQuery(socket: any, text: string) {
  const wref = { current: world };
  const bcast = () => broadcast({ type: 'state', world });
  const cards = await queryAgent(wref, text, bcast);
  socket.emit("message", JSON.stringify({ type: 'agent_reply', cards: cards as any }));
}

function resetGame() {
  resetDB();
  world = createWorld();
  saveWorld(world);
  broadcast({ type: 'state', world });
}

// ──── 游戏主循环（回合制） ────
let turn = 0; // 0=factory, 1=customer

function broadcastLog(tag: string, msg: string) {
  io.emit("message", JSON.stringify({ type: 'agent_log', tag, msg }));
  const time = new Date().toISOString();
  try {
    const logDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'agent.log'), `[${time}] [${tag}] ${msg}\n`);
  } catch {}
}

function restartTickLoop() {
  if (tickTimer) clearInterval(tickTimer);
  const interval = Math.max(50, Math.round(TICK_MS / world.speed));
  tickTimer = setInterval(async () => {
    world = tickWorld(world);
    broadcast({ type: 'state', world });

    // 回合制：每 10 tick，工厂和顾客轮流行动
    if (!world.paused && world.tick > 0 && world.tick % 10 === 0) {
      const wref = { current: world };
      const bcast = () => broadcast({ type: 'state', world: wref.current });
      const onLog = (tag: string, msg: string) => {
        console.log(`[Agent.${tag}] ${new Date().toISOString().slice(11, 19)} ${msg}`);
        broadcastLog(tag, msg);
      };
      // 工厂和客户之间间隔 1.5 秒，避免 API 限流
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      if (turn === 0) {
        broadcastLog('turn', '🏭 工厂回合');
        await runFactoryAgent(wref, bcast, onLog).catch(() => {});
        turn = 1;
      } else {
        broadcastLog('turn', '🧑‍💼 客户回合');
        await runCustomerAgent(wref, bcast, onLog).catch(() => {});
        turn = 0;
      }
      await sleep(1500); // 限流保护
      // 确保 agent 的修改同步到 world
      world = wref.current;
    }
  }, interval);
}

function startAutoSave() {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = setInterval(() => { saveWorld(world); }, 10_000);
}

// ──── 启动 ────
const PORT = Number(process.env.PORT) || 43001;

server.listen(PORT, () => {
  console.log(`
  🏭 工厂模拟游戏
  http://localhost:${PORT}
  地图: ${world.width}×${world.height}  tick=${world.tick}  speed=${world.speed}x
  📂 存档: 每 10 秒自动保存至 SQLite
  `);
  restartTickLoop();
  startAutoSave();
});

// ──── 优雅退出 ────
process.on('SIGINT', () => {
  console.log('\n  保存中…');
  saveWorld(world);
  closeDB();
  process.exit(0);
});
process.on('SIGTERM', () => {
  saveWorld(world);
  closeDB();
  process.exit(0);
});