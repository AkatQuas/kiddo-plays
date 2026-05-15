import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 1;

export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    -- 菜品表 (Dish table)
    CREATE TABLE IF NOT EXISTS dish_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.00,
      dish_img TEXT DEFAULT NULL,
      stock_num_daily INTEGER NOT NULL DEFAULT 0,
      is_sold_out_today INTEGER NOT NULL DEFAULT 0,
      is_delete INTEGER NOT NULL DEFAULT 0,
      create_time TIMESTAMP DEFAULT (datetime('now','localtime')),
      update_time TIMESTAMP DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_dish_name ON dish_table(dish_name);
    CREATE INDEX IF NOT EXISTS idx_dish_sold_out ON dish_table(is_sold_out_today);

    -- 订单表 (Order table)
    CREATE TABLE IF NOT EXISTS order_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      table TEXT NOT NULL DEFAULT '自由',
      total_money REAL NOT NULL DEFAULT 0.00,
      order_status TEXT NOT NULL DEFAULT '未支付',
      refund_remark TEXT DEFAULT NULL,
      refund_time TIMESTAMP DEFAULT NULL,
      refund_method TEXT DEFAULT NULL,
      create_time TIMESTAMP DEFAULT (datetime('now','localtime')),
      update_time TIMESTAMP DEFAULT (datetime('now','localtime')),
      operate_log_id INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_order_no ON order_table(order_no);
    CREATE INDEX IF NOT EXISTS idx_order_status ON order_table(order_status);
    CREATE INDEX IF NOT EXISTS idx_order_create_time ON order_table(create_time);

    -- 订单项表 (Order item table)
    CREATE TABLE IF NOT EXISTS order_item_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      dish_id INTEGER NOT NULL,
      buy_num INTEGER NOT NULL DEFAULT 1,
      single_price REAL NOT NULL DEFAULT 0.00,
      create_time TIMESTAMP DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (order_id) REFERENCES order_table(id)
    );
    CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item_table(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_item_dish ON order_item_table(dish_id);

    -- 系统配置表 (System config table)
    CREATE TABLE IF NOT EXISTS system_config_table (
      id INTEGER PRIMARY KEY DEFAULT 1,
      shop_name TEXT NOT NULL DEFAULT '',
      table_num INTEGER NOT NULL DEFAULT 99,
      admin_pwd TEXT NOT NULL DEFAULT '',
      bio_unlock INTEGER NOT NULL DEFAULT 0,
      timeout_time INTEGER NOT NULL DEFAULT 300,
      encrypt_key TEXT DEFAULT NULL,
      is_initialized INTEGER NOT NULL DEFAULT 0,
      disclaimer_accepted INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      update_time TIMESTAMP DEFAULT (datetime('now','localtime'))
    );

    -- 每日聚合统计表 (Daily stats table)
    CREATE TABLE IF NOT EXISTS daily_total_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statics_date TEXT NOT NULL,
      total_order INTEGER NOT NULL DEFAULT 0,
      total_money REAL NOT NULL DEFAULT 0.00,
      refund_money REAL NOT NULL DEFAULT 0.00,
      avg_price REAL NOT NULL DEFAULT 0.00,
      create_time TIMESTAMP DEFAULT (datetime('now','localtime')),
      md5_check TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_total_table(statics_date);

    -- 菜品日统计表 (Daily dish stats table)
    CREATE TABLE IF NOT EXISTS daily_dish_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statics_date TEXT NOT NULL,
      dish_id INTEGER NOT NULL,
      sell_num INTEGER NOT NULL DEFAULT 0,
      sell_money REAL NOT NULL DEFAULT 0.00,
      create_time TIMESTAMP DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_daily_dish_date ON daily_dish_table(statics_date);
    CREATE INDEX IF NOT EXISTS idx_daily_dish_id ON daily_dish_table(dish_id);

    -- 操作日志表 (Operation log table)
    CREATE TABLE IF NOT EXISTS operation_log_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      detail TEXT DEFAULT NULL,
      operator TEXT DEFAULT 'admin',
      create_time TIMESTAMP DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_oplog_type ON operation_log_table(action_type);
    CREATE INDEX IF NOT EXISTS idx_oplog_time ON operation_log_table(create_time);

    -- 数据库版本记录
    CREATE TABLE IF NOT EXISTS db_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT (datetime('now','localtime'))
    );

    INSERT INTO db_version (version) VALUES (1);
  `);
}

export async function down(db: SQLiteDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS operation_log_table;
    DROP TABLE IF EXISTS daily_dish_table;
    DROP TABLE IF EXISTS daily_total_table;
    DROP TABLE IF EXISTS system_config_table;
    DROP TABLE IF EXISTS order_item_table;
    DROP TABLE IF EXISTS order_table;
    DROP TABLE IF EXISTS dish_table;
    DROP TABLE IF EXISTS db_version;
  `);
}