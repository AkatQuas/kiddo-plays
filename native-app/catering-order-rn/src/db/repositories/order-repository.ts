import { getDatabase } from '../database';

export interface Order {
  id: number;
  order_no: string;
  table: string;
  total_money: number;
  order_status: string;
  refund_remark: string | null;
  refund_time: string | null;
  refund_method: string | null;
  create_time: string;
  update_time: string;
  operate_log_id: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  dish_id: number;
  buy_num: number;
  single_price: number;
  create_time: string;
  dish_name?: string;
}

export async function createOrder(
  orderNo: string,
  table: string,
  totalMoney: number,
  items: { dish_id: number; buy_num: number; single_price: number }[]
): Promise<number> {
  const db = await getDatabase();
  await db.execAsync('BEGIN TRANSACTION');
  try {
    const orderResult = await db.runAsync(
      `INSERT INTO order_table (order_no, table, total_money) VALUES (?, ?, ?)`,
      [orderNo, table, totalMoney]
    );
    const orderId = orderResult.lastInsertRowId;

    for (const item of items) {
      await db.runAsync(
        `INSERT INTO order_item_table (order_id, dish_id, buy_num, single_price) VALUES (?, ?, ?, ?)`,
        [orderId, item.dish_id, item.buy_num, item.single_price]
      );
    }

    await db.execAsync('COMMIT');
    return orderId;
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function getTodayOrders(): Promise<Order[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Order>(
    `SELECT * FROM order_table
     WHERE date(create_time) = date('now','localtime')
     ORDER BY create_time DESC`
  );
}

export async function getOrderById(id: number): Promise<Order | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Order>(
    'SELECT * FROM order_table WHERE id = ?',
    [id]
  );
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDatabase();
  return await db.getAllAsync<OrderItem>(
    `SELECT oi.*, d.dish_name
     FROM order_item_table oi
     LEFT JOIN dish_table d ON oi.dish_id = d.id
     WHERE oi.order_id = ?`,
    [orderId]
  );
}

export async function updateOrderStatus(
  id: number,
  status: string,
  refundRemark?: string,
  refundMethod?: string,
  operateLogId?: number
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = ["order_status = ?", "update_time = datetime('now','localtime')"];
  const values: any[] = [status];

  if (status === '已退款') {
    sets.push("refund_time = datetime('now','localtime')");
    if (refundRemark !== undefined) {
      sets.push('refund_remark = ?');
      values.push(refundRemark);
    }
    if (refundMethod !== undefined) {
      sets.push('refund_method = ?');
      values.push(refundMethod);
    }
  }

  if (operateLogId !== undefined) {
    sets.push('operate_log_id = ?');
    values.push(operateLogId);
  }

  values.push(id);
  await db.runAsync(
    `UPDATE order_table SET ${sets.join(', ')} WHERE id = ?`,
    values
  );
}

export async function getOrdersByFilters(filters: {
  dateRange?: [string, string];
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ orders: Order[]; total: number }> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const values: any[] = [];

  if (filters.dateRange) {
    conditions.push('date(create_time) >= ? AND date(create_time) <= ?');
    values.push(filters.dateRange[0], filters.dateRange[1]);
  }
  if (filters.status) {
    conditions.push('order_status = ?');
    values.push(filters.status);
  }
  if (filters.minAmount !== undefined) {
    conditions.push('total_money >= ?');
    values.push(filters.minAmount);
  }
  if (filters.maxAmount !== undefined) {
    conditions.push('total_money <= ?');
    values.push(filters.maxAmount);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const countRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM order_table ${where}`,
    values
  );

  const orders = await db.getAllAsync<Order>(
    `SELECT * FROM order_table ${where} ORDER BY create_time DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  return { orders, total: countRow?.total ?? 0 };
}

export async function getOrdersByDateRange(
  startDate: string,
  endDate: string
): Promise<Order[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Order>(
    `SELECT * FROM order_table
     WHERE date(create_time) >= ? AND date(create_time) <= ?
     ORDER BY create_time ASC`,
    [startDate, endDate]
  );
}