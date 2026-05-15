import { create } from 'zustand';
import { getTodayStats, getDailyStats, getDishSales } from '@/src/db/repositories/stats-repository';

interface StatsStore {
  briefStats: { totalOrder: number; totalMoney: number; popularDish: string | null };
  dateRange: 'day' | 'week' | 'month' | 'year';
  revenueData: { date: string; amount: number }[];
  dishDistribution: { name: string; sales: number; money: number }[];
  isLoading: boolean;
  error: string | null;

  fetchBriefStats: () => Promise<void>;
  fetchDetailedStats: (range: string) => Promise<void>;
  setDateRange: (range: 'day' | 'week' | 'month' | 'year') => void;
}

function getDateRange(range: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  let start: string;

  switch (range) {
    case 'day':
      start = end;
      break;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      start = weekAgo.toISOString().slice(0, 10);
      break;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      start = monthAgo.toISOString().slice(0, 10);
      break;
    case 'year':
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      start = yearAgo.toISOString().slice(0, 10);
      break;
    default:
      start = end;
  }
  return { start, end };
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  briefStats: { totalOrder: 0, totalMoney: 0, popularDish: null },
  dateRange: 'day',
  revenueData: [],
  dishDistribution: [],
  isLoading: false,
  error: null,

  fetchBriefStats: async () => {
    try {
      const stats = await getTodayStats();
      set({
        briefStats: {
          totalOrder: stats.totalOrder,
          totalMoney: stats.totalMoney,
          popularDish: stats.popularDish,
        },
      });
    } catch (e: any) {
      console.error('fetchBriefStats error:', e);
    }
  },

  fetchDetailedStats: async (range) => {
    set({ isLoading: true, error: null });
    try {
      const { start, end } = getDateRange(range);

      const dailyStats = await getDailyStats(start, end);
      const revenueData = dailyStats.map(d => ({
        date: d.statics_date,
        amount: d.total_money,
      }));

      const dishSales = await getDishSales(start, end);
      const dishMap = new Map<string, { sales: number; money: number }>();
      for (const d of dishSales) {
        const name = d.dish_name ?? `菜品#${d.dish_id}`;
        const existing = dishMap.get(name) ?? { sales: 0, money: 0 };
        existing.sales += d.sell_num;
        existing.money += d.sell_money;
        dishMap.set(name, existing);
      }
      const dishDistribution = Array.from(dishMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.sales - a.sales);

      set({ revenueData, dishDistribution });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  setDateRange: (range) => set({ dateRange: range }),
}));