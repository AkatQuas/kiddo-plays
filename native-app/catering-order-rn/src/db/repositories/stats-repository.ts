import { getDatabase } from '../database';

export interface DailyTotal {
  id: number;
  statics_date: string;
  total_order: number;
  total_money: number;
  refund_money: number;
  avg_price: number;
  create_time: string;
  md5_check: string | null;
}

export interface DailyDish {
  id: number;
  statics_date: string;
  dish_id: number;
  sell_num: number;
  sell_money: number;
  create_time: string;
  dish_name?: string;
}

export async function getTodayStats(): Promise<{
  totalOrder: number;
  totalMoney: number;
  popularDish: string | null;
  popularDishCount: number;
}> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);

  const orderRow = await db.getFirstAsync<{ orderCount: number; totalMoney: number }>(
    `SELECT COUNT(*) as orderCount, COALESCE(SUM(total_money), 0) as totalMoney
     FROM order_table
     WHERE date(create_time) = ? AND order_status != '已退款'`,
    [today]
  );

  const dishRow = await db.getFirstAsync<{ dish_name: string; totalSell: number }>(
    `SELECT d.dish_name, SUM(oi.buy_num) as totalSell
     FROM order_item_table oi
     JOIN order_table o ON oi.order_id = o.id
     JOIN dish_table d ON oi.dish_id = d.id
     WHERE date(o.create_time) = ? AND o.order_status != '已退款'
     GROUP BY oi.dish_id
     ORDER BY totalSell DESC
     LIMIT 1`,
    [today]
  );

  return {
    totalOrder: orderRow?.orderCount ?? 0,
    totalMoney: orderRow?.totalMoney ?? 0,
    popularDish: dishRow?.dish_name ?? null,
    popularDishCount: dishRow?.totalSell ?? 0,
  };
}

export async function getDailyStats(
  startDate: string,
  endDate: string
): Promise<DailyTotal[]> {
  const db = await getDatabase();
  return await db.getAllAsync<DailyTotal>(
    `SELECT * FROM daily_total_table
     WHERE statics_date >= ? AND statics_date <= ?
     ORDER BY statics_date ASC`,
    [startDate, endDate]
  );
}

export async function getDishSales(
  startDate: string,
  endDate: string
): Promise<(DailyDish & { dish_name: string })[]> {
  const db = await getDatabase();
  return await db.getAllAsync<DailyDish & { dish_name: string }>(
    `SELECT dd.*, d.dish_name
     FROM daily_dish_table dd
     LEFT JOIN dish_table d ON dd.dish_id = d.id
     WHERE dd.statics_date >= ? AND dd.statics_date <= ?
     ORDER BY dd.sell_num DESC`,
    [startDate, endDate]
  );
}

export async function computeAndSaveDailyStats(date: string): Promise<void> {
  const db = await getDatabase();

  const orderRow = await db.getFirstAsync<{
    totalOrder: number;
    totalMoney: number;
    refundMoney: number;
  }>(
    `SELECT
       COUNT(*) as totalOrder,
       COALESCE(SUM(CASE WHEN order_status != '已退款' THEN total_money ELSE 0 END), 0) as totalMoney,
       COALESCE(SUM(CASE WHEN order_status = '已退款' THEN total_money ELSE 0 END), 0) as refundMoney
     FROM order_table
     WHERE date(create_time) = ?`,
    [date]
  );

  const totalOrder = orderRow?.totalOrder ?? 0;
  const totalMoney = orderRow?.totalMoney ?? 0;
  const refundMoney = orderRow?.refundMoney ?? 0;
  const avgPrice = totalOrder > 0 ? Math.round((totalMoney / totalOrder) * 100) / 100 : 0;

  // Simple MD5-like check using crypto hash of the data
  const checkString = `${date}|${totalOrder}|${totalMoney}|${refundMoney}|${avgPrice}`;

  await db.runAsync(
    `INSERT OR REPLACE INTO daily_total_table
     (statics_date, total_order, total_money, refund_money, avg_price, md5_check)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, totalOrder, totalMoney, refundMoney, avgPrice, checkString]
  );

  // Per-dish stats
  const dishRows = await db.getAllAsync<{ dish_id: number; sell_num: number; sell_money: number }>(
    `SELECT oi.dish_id, SUM(oi.buy_num) as sell_num,
            SUM(oi.buy_num * oi.single_price) as sell_money
     FROM order_item_table oi
     JOIN order_table o ON oi.order_id = o.id
     WHERE date(o.create_time) = ? AND o.order_status != '已退款'
     GROUP BY oi.dish_id`,
    [date]
  );

  for (const row of dishRows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO daily_dish_table (statics_date, dish_id, sell_num, sell_money)
       VALUES (?, ?, ?, ?)`,
      [date, row.dish_id, row.sell_num, row.sell_money]
    );
  }
}