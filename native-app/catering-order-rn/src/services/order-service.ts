import { getDatabase } from '@/src/db/database';
import { createOrder } from '@/src/db/repositories/order-repository';
import { deductStock } from '@/src/db/repositories/dish-repository';
import { logOperation } from '@/src/db/repositories/operation-log-repository';
import { generateOrderNo } from './auth-service';
import type { CartItem } from '@/src/stores/order-store';

export async function submitOrder(
  cartItems: CartItem[],
  table: string
): Promise<number> {
  if (cartItems.length === 0) throw new Error('购物车为空');

  const db = await getDatabase();
  const orderNo = generateOrderNo();
  const totalMoney = cartItems.reduce(
    (sum, item) => sum + item.dish.price * item.quantity,
    0
  );

  const orderItems = cartItems.map(item => ({
    dish_id: item.dish.id,
    buy_num: item.quantity,
    single_price: item.dish.price,
  }));

  await db.execAsync('BEGIN TRANSACTION');
  try {
    const orderId = await createOrder(orderNo, table, totalMoney, orderItems);

    for (const item of cartItems) {
      await deductStock(item.dish.id, item.quantity);
    }

    await db.execAsync('COMMIT');
    return orderId;
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function submitOrderWithLogging(
  cartItems: CartItem[],
  table: string
): Promise<number> {
  const orderId = await submitOrder(cartItems, table);
  await logOperation(
    'order_create',
    `订单#${orderId} 创建, 桌号: ${table}, 金额: ${cartItems.reduce((s, i) => s + i.dish.price * i.quantity, 0)}`
  );
  return orderId;
}