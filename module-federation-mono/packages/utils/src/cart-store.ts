import type { CartItem } from '@mf-monorepo/types';
import { MF_EVENTS } from '@mf-monorepo/types';
import { create } from 'zustand';

interface CartStore {
  cartItems: CartItem[];
  cartOpen: boolean;
  checkoutOpen: boolean;

  // Actions
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  handleCheckout: () => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cartItems: [],
  cartOpen: false,
  checkoutOpen: false,

  addToCart: (item) => {
    set((state) => {
      const existing = state.cartItems.find((i) => i.id === item.id);
      if (existing) {
        return {
          cartItems: state.cartItems.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        };
      }
      return {
        cartItems: [...state.cartItems, { ...item, quantity: 1 }]
      };
    });
  },

  updateQuantity: (id, delta) => {
    set((state) => ({
      cartItems: state.cartItems.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    }));
  },

  removeItem: (id) => {
    set((state) => ({
      cartItems: state.cartItems.filter((item) => item.id !== id)
    }));
  },

  setCartOpen: (open) => {
    set({ cartOpen: open });
  },

  setCheckoutOpen: (open) => {
    set({ checkoutOpen: open });
  },

  handleCheckout: () => {
    set({ cartOpen: false, checkoutOpen: true });
  }
}));

// Initialize event listener
if (typeof window !== 'undefined') {
  const handleAddToCart = (e: CustomEvent) => {
    const item = e.detail as Omit<CartItem, 'quantity'>;
    useCartStore.getState().addToCart(item);
    useCartStore.getState().setCartOpen(true);
  };

  window.addEventListener(
    MF_EVENTS.ADD_TO_CART,
    handleAddToCart as EventListener
  );
}
