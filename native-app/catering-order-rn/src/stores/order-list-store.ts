import { create } from 'zustand';
import {
  getTodayOrders,
  updateOrderStatus,
  getOrderItems,
  type Order,
  type OrderItem,
} from '@/src/db/repositories/order-repository';
import { deductStock } from '@/src/db/repositories/dish-repository';
import { logOperation } from '@/src/db/repositories/operation-log-repository';
import { getTodayStats } from '@/src/db/repositories/stats-repository';

interface OrderListStore {
  orders: Order[];
  activeFilter: string;
  isLoading: boolean;
  error: string | null;
  todayStats: {
    totalOrder: number;
    totalMoney: number;
    popularDish: string | null;
  };

  fetchTodayOrders: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setFilter: (filter: string) => void;
  getFilteredOrders: () => Order[];
  confirmPayment: (orderId: number) => Promise<void>;
  processRefund: (orderId: number, remark: string, method: string) => Promise<void>;
  getOrderItems: (orderId: number) => Promise<OrderItem[]>;
}

export const useOrderListStore = create<OrderListStore>((set, get) => ({
  orders: [],
  activeFilter: '全部',
  isLoading: false,
  error: null,
  todayStats: { totalOrder: 0, totalMoney: 0, popularDish: null },

  fetchTodayOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await getTodayOrders();
      set({ orders });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await getTodayStats();
      set({ todayStats: stats });
    } catch (e: any) {
      console.error('fetchStats error:', e);
    }
  },

  setFilter: (filter) => set({ activeFilter: filter }),

  getFilteredOrders: () => {
    const { orders, activeFilter } = get();
    if (activeFilter === '全部') return orders;
    return orders.filter(o => o.order_status === activeFilter);
  },

  confirmPayment: async (orderId) => {
    await updateOrderStatus(orderId, '已支付');
    await get().fetchTodayOrders();
    await get().fetchStats();
  },

  processRefund: async (orderId, remark, method) => {
    const logId = await logOperation('refund', `订单#${orderId} 退款: ${remark}, 方式: ${method}`);
    await updateOrderStatus(orderId, '已退款', remark, method, logId);
    await get().fetchTodayOrders();
    await get().fetchStats();
  },

  getOrderItems: async (orderId) => {
    return await getOrderItems(orderId);
  },
}));