// ============================================================
// better-sqlite3 持久化层
// 整个世界状态序列化成一个 JSON 行存，简单可靠
// ============================================================

import Database from 'better-sqlite3';
import { WorldState } from './types.js';
import { createWorld } from './world.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'savegame.db');
let db: Database.Database;

export function initDB(): void {
  // 确保 data 目录存在
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS savegame (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tick INTEGER NOT NULL DEFAULT 0,
      money REAL NOT NULL DEFAULT 0,
      world TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function saveWorld(world: WorldState): void {
  db.prepare(`
    INSERT INTO savegame (id, tick, money, world, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      tick = excluded.tick,
      money = excluded.money,
      world = excluded.world,
      updated_at = excluded.updated_at
  `).run(world.tick, world.money, JSON.stringify(world));
}

export function loadWorld(): WorldState | null {
  const row = db.prepare('SELECT * FROM savegame WHERE id = 1').get() as any;
  if (!row) return null;
  try {
    return JSON.parse(row.world) as WorldState;
  } catch {
    return null;
  }
}

export function loadOrCreateWorld(width = 24, height = 16): WorldState {
  const loaded = loadWorld();
  if (loaded) {
    console.log(`  📂 读取存档：tick=${loaded.tick} 金钱=¥${loaded.money} 机器数=${Object.keys(loaded.tiles).length}`);
    return loaded;
  }
  const world = createWorld(width, height);
  saveWorld(world);
  console.log(`  🆕 新游戏：${width}×${height} 地图`);
  return world;
}

export function resetDB(): void {
  db.prepare('DELETE FROM savegame').run();
}

export function closeDB(): void {
}
