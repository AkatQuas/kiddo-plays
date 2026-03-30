/**
 * Cart Widget Component - Exposed via Module Federation
 * Mini cart display for header
 */

import { Badge } from '@mf-monorepo/ui';
import { useCartStore } from '@mf-monorepo/utils';
import { ShoppingCart } from 'lucide-react';

interface CartWidgetProps {
  items?: any[]; // Keep for backward compatibility, but not used
}

export default function CartWidget({ items: _externalItems }: CartWidgetProps) {
  const { cartItems } = useCartStore();

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

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
              fontSize: '0.625rem'
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
