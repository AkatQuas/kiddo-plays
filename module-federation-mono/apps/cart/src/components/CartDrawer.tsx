/**
 * Cart Drawer Component - Exposed via Module Federation
 * Slide-out cart panel
 */

import { Button, Card, CardContent } from '@mf-monorepo/ui';
import { useCartStore } from '@mf-monorepo/utils';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

interface CartDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  items?: any[]; // Keep for backward compatibility
  onUpdateQuantity?: (id: string, delta: number) => void;
  onRemoveItem?: (id: string) => void;
  onCheckout?: () => void;
}

export default function CartDrawer({
  isOpen = true,
  onClose,
  onCheckout
}: CartDrawerProps) {
  const { cartItems, updateQuantity, removeItem, handleCheckout, setCartOpen } =
    useCartStore();

  const items = cartItems;

  const handleClose = () => {
    if (onClose) onClose();
    else setCartOpen(false);
  };

  const handleCheckoutClick = () => {
    if (onCheckout) onCheckout();
    else handleCheckout();
  };

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        maxWidth: '100vw',
        height: '100vh',
        backgroundColor: 'white',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ShoppingBag size={20} />
          Shopping Cart
        </h2>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem'
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {items.length === 0 ? (
          <div
            style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}
          >
            <ShoppingBag
              size={48}
              style={{ marginBottom: '1rem', opacity: 0.5 }}
            />
            <p>Your cart is empty</p>
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: '60px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {item.name}
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                        ${item.price.toFixed(2)}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          style={{
                            background: '#f3f4f6',
                            border: 'none',
                            borderRadius: '4px',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <span
                          style={{
                            fontSize: '0.875rem',
                            minWidth: '20px',
                            textAlign: 'center'
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          style={{
                            background: '#f3f4f6',
                            border: 'none',
                            borderRadius: '4px',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            marginLeft: 'auto'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}
        >
          <span style={{ fontWeight: 600 }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>
            ${total.toFixed(2)}
          </span>
        </div>
        <Button
          style={{ width: '100%' }}
          disabled={items.length === 0}
          onClick={handleCheckoutClick}
        >
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}
