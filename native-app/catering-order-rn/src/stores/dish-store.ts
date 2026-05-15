import { create } from 'zustand';
import {
  getAllDishes,
  createDish,
  updateDish,
  deleteDish,
  toggleSoldOutDish,
  deductStock,
  type Dish,
} from '@/src/db/repositories/dish-repository';

interface DishStore {
  dishes: Dish[];
  isLoading: boolean;
  error: string | null;

  fetchDishes: () => Promise<void>;
  addDish: (name: string, price: number, img: string | null, stock: number) => Promise<void>;
  editDish: (id: number, data: Partial<Pick<Dish, 'dish_name' | 'price' | 'dish_img' | 'stock_num_daily'>>) => Promise<void>;
  removeDish: (id: number) => Promise<void>;
  toggleSoldOut: (id: number) => Promise<void>;
  deductStockForDish: (dishId: number, quantity: number) => Promise<void>;
}

export const useDishStore = create<DishStore>((set, get) => ({
  dishes: [],
  isLoading: false,
  error: null,

  fetchDishes: async () => {
    set({ isLoading: true, error: null });
    try {
      const dishes = await getAllDishes();
      set({ dishes });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addDish: async (name, price, img, stock) => {
    await createDish(name, price, img, stock);
    await get().fetchDishes();
  },

  editDish: async (id, data) => {
    await updateDish(id, data);
    await get().fetchDishes();
  },

  removeDish: async (id) => {
    await deleteDish(id);
    await get().fetchDishes();
  },

  toggleSoldOut: async (id) => {
    const dish = get().dishes.find(d => d.id === id);
    if (!dish) return;
    await toggleSoldOutDish(id, dish.is_sold_out_today === 0);
    await get().fetchDishes();
  },

  deductStockForDish: async (dishId, quantity) => {
    await deductStock(dishId, quantity);
    await get().fetchDishes();
  },
}));