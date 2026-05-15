import { getDatabase } from '../database';

export interface Dish {
  id: number;
  dish_name: string;
  price: number;
  dish_img: string | null;
  stock_num_daily: number;
  is_sold_out_today: number;
  is_delete: number;
  create_time: string;
  update_time: string;
}

export async function getAllDishes(): Promise<Dish[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Dish>(
    'SELECT * FROM dish_table WHERE is_delete = 0 ORDER BY id ASC'
  );
}

export async function getDishById(id: number): Promise<Dish | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<Dish>(
    'SELECT * FROM dish_table WHERE id = ?',
    [id]
  );
}

export async function createDish(
  name: string,
  price: number,
  imgPath: string | null,
  stock: number
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO dish_table (dish_name, price, dish_img, stock_num_daily)
     VALUES (?, ?, ?, ?)`,
    [name, price, imgPath, stock]
  );
  return result.lastInsertRowId;
}

export async function updateDish(
  id: number,
  data: Partial<Pick<Dish, 'dish_name' | 'price' | 'dish_img' | 'stock_num_daily'>>
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: any[] = [];

  if (data.dish_name !== undefined) {
    sets.push('dish_name = ?');
    values.push(data.dish_name);
  }
  if (data.price !== undefined) {
    sets.push('price = ?');
    values.push(data.price);
  }
  if (data.dish_img !== undefined) {
    sets.push('dish_img = ?');
    values.push(data.dish_img);
  }
  if (data.stock_num_daily !== undefined) {
    sets.push('stock_num_daily = ?');
    values.push(data.stock_num_daily);
  }

  if (sets.length === 0) return;

  sets.push("update_time = datetime('now','localtime')");
  values.push(id);

  await db.runAsync(
    `UPDATE dish_table SET ${sets.join(', ')} WHERE id = ?`,
    values
  );
}

export async function toggleSoldOutDish(id: number, soldOut: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE dish_table SET is_sold_out_today = ?, update_time = datetime('now','localtime') WHERE id = ?`,
    [soldOut ? 1 : 0, id]
  );
}

export async function deleteDish(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE dish_table SET is_delete = 1, update_time = datetime('now','localtime') WHERE id = ?`,
    [id]
  );
}

export async function deductStock(dishId: number, quantity: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE dish_table SET stock_num_daily = MAX(0, stock_num_daily - ?),
     update_time = datetime('now','localtime') WHERE id = ?`,
    [quantity, dishId]
  );
}

export async function getDistinctCategories(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ dish_name: string }>(
    'SELECT DISTINCT dish_name FROM dish_table WHERE is_delete = 0 ORDER BY dish_name'
  );
  return rows.map(r => r.dish_name);
}