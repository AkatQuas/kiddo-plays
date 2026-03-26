/**
 * Cart Widget Component - Exposed via Module Federation
 * Mini cart display for header
 */

import { useState, useEffect } from 'react';
import { Button, Badge } from '@mf-monorepo/ui';
import { ShoppingCart } from 'lucide-react';
import type { CartItem } from '@mf-monorepo/types';

interface CartWidgetProps {
  items?: CartItem[];
}

export default function CartWidget({ items: externalItems }: CartWidgetProps) {
  const [internalItems, setInternalItems] = useState<CartItem[]>([]);

  // Use external items if provided, otherwise use internal state
  const items = externalItems ?? internalItems;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Internal event listener only when not using external items
  useEffect(() => {
    if (externalItems !== undefined) return; // Skip if using external items

    const handleAddToCart = (e: CustomEvent) => {
      const item = e.detail as Omit<CartItem, 'quantity'>;
      setInternalItems((prev) => {
        const existing = prev.find((i) => i.id === item.id);
        if (existing) {
          return prev.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    };

    window.addEventListener('mf:add-to-cart', handleAddToCart as EventListener);

    return () => {
      window.removeEventListener('mf:add-to-cart', handleAddToCart as EventListener);
    };
  }, [externalItems]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative' }}>
        <ShoppingCart size={24} />
        {totalItems > 0 && (
          <Badge
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '0.625rem',
            }}
          >
            {totalItems}
          </Badge>
        )}
      </div>
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
        ${totalPrice.toFixed(2)}
      </span>
    </div>
  );
}

export type { CartItem };
