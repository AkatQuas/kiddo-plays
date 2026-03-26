/**
 * Host Application - Main entry point
 * Demonstrates Module Federation by loading remote components
 */

import { Suspense, lazy, useState, useEffect, startTransition } from 'react';
import Layout from './components/Layout';
import type { CartItem } from '@mf-monorepo/types';
import { MF_EVENTS } from '@mf-monorepo/types';

// Lazy load remote modules
const ProductsList = lazy(() => import('products/ProductsList'));
const CartWidget = lazy(() => import('cart/CartWidget'));
const CartDrawer = lazy(() => import('cart/CartDrawer'));
const Checkout = lazy(() => import('cart/Checkout'));
const UserMenu = lazy(() => import('user/UserMenu'));

function LoadingFallback({ module }: { module: string }) {
  return (
    <div
      style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        margin: '1rem 0',
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          border: '2px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          margin: '0 auto 0.5rem',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Loading {module}...
    </div>
  );
}

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Listen for add to cart events from products
  useEffect(() => {
    const handleAddToCart = (e: CustomEvent) => {
      const item = e.detail as Omit<CartItem, 'quantity'>;
      setCartItems((prev) => {
        const existing = prev.find((i) => i.id === item.id);
        if (existing) {
          return prev.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
      startTransition(() => setCartOpen(true));
    };

    window.addEventListener(MF_EVENTS.ADD_TO_CART, handleAddToCart as EventListener);
    return () => {
      window.removeEventListener(MF_EVENTS.ADD_TO_CART, handleAddToCart as EventListener);
    };
  }, []);

  const updateQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const handleCheckoutClose = () => {
    setCheckoutOpen(false);
  };

  // Show checkout page instead of products when checkout is open
  const showCheckout = checkoutOpen;

  return (
    <Layout
      header={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 2rem',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'white',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>My Store</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => startTransition(() => setCartOpen(!cartOpen))}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Suspense fallback={<LoadingFallback module="Cart" />}>
                <CartWidget items={cartItems} />
              </Suspense>
            </button>
            <Suspense fallback={<LoadingFallback module="User" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      }
      sidebar={
        <div style={{ padding: '1rem', borderRight: '1px solid #e5e7eb', width: '200px' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Categories</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {['Electronics', 'Clothing', 'Home', 'Sports', 'Books'].map((cat) => (
              <li
                key={cat}
                style={{
                  padding: '0.5rem',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                {cat}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      {showCheckout ? (
        <Suspense fallback={<LoadingFallback module="Checkout" />}>
          <Checkout items={cartItems} onClose={handleCheckoutClose} />
        </Suspense>
      ) : (
        <Suspense fallback={<LoadingFallback module="Products" />}>
          <ProductsList />
        </Suspense>
      )}

      {/* Always render CartDrawer (but hidden) to keep state and listen for events */}
      <Suspense fallback={null}>
        <CartDrawer
          isOpen={cartOpen}
          items={cartItems}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onCheckout={handleCheckout}
          onClose={() => startTransition(() => setCartOpen(false))}
        />
      </Suspense>
    </Layout>
  );
}
