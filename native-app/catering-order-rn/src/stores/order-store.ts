import { create } from 'zustand';
import type { Dish } from '@/src/db/repositories/dish-repository';

export interface CartItem {
  dish: Dish;
  quantity: number;
}

interface OrderStore {
  cart1: CartItem[];
  cart2: CartItem[];
  activeCartIndex: 1 | 2;
  currentTable: string;

  addToCart: (dish: Dish, cartIndex?: 1 | 2) => void;
  removeFromCart: (dishId: number, cartIndex?: 1 | 2) => void;
  updateQuantity: (dishId: number, delta: number, cartIndex?: 1 | 2) => void;
  clearCart: (cartIndex?: 1 | 2) => void;
  clearAllCarts: () => void;
  setActiveCart: (index: 1 | 2) => void;
  setTable: (table: string) => void;
  getActiveCartTotal: () => number;
  getCartCount: (cartIndex: 1 | 2) => number;
  getActiveCartItems: () => CartItem[];
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  cart1: [],
  cart2: [],
  activeCartIndex: 1,
  currentTable: '自由',

  addToCart: (dish, cartIndex) => {
    const idx = cartIndex ?? get().activeCartIndex;
    const cartKey = idx === 1 ? 'cart1' : 'cart2';
    const cart = get()[cartKey];
    const existing = cart.find(item => item.dish.id === dish.id);
    if (existing) {
      set({
        [cartKey]: cart.map(item =>
          item.dish.id === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      });
    } else {
      set({ [cartKey]: [...cart, { dish, quantity: 1 }] });
    }
  },

  removeFromCart: (dishId, cartIndex) => {
    const idx = cartIndex ?? get().activeCartIndex;
    const cartKey = idx === 1 ? 'cart1' : 'cart2';
    set({ [cartKey]: get()[cartKey].filter(item => item.dish.id !== dishId) });
  },

  updateQuantity: (dishId, delta, cartIndex) => {
    const idx = cartIndex ?? get().activeCartIndex;
    const cartKey = idx === 1 ? 'cart1' : 'cart2';
    const cart = get()[cartKey];
    const newCart = cart
      .map(item =>
        item.dish.id === dishId
          ? { ...item, quantity: item.quantity + delta }
          : item
      )
      .filter(item => item.quantity > 0);
    set({ [cartKey]: newCart });
  },

  clearCart: (cartIndex) => {
    const idx = cartIndex ?? get().activeCartIndex;
    const cartKey = idx === 1 ? 'cart1' : 'cart2';
    set({ [cartKey]: [] });
  },

  clearAllCarts: () => set({ cart1: [], cart2: [] }),

  setActiveCart: (index) => set({ activeCartIndex: index }),

  setTable: (table) => set({ currentTable: table }),

  getActiveCartTotal: () => {
    const idx = get().activeCartIndex;
    const cart = idx === 1 ? get().cart1 : get().cart2;
    return cart.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  },

  getCartCount: (cartIndex) => {
    const idx = cartIndex ?? get().activeCartIndex;
    const cart = idx === 1 ? get().cart1 : get().cart2;
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },

  getActiveCartItems: () => {
    const idx = get().activeCartIndex;
    return idx === 1 ? get().cart1 : get().cart2;
  },
}));