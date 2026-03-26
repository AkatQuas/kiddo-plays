/**
 * Product Card Component - Exposed via Module Federation
 */

import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@mf-monorepo/ui';
import type { Product } from './ProductsList';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const handleAddToCart = () => {
    // Dispatch custom event for cart integration
    window.dispatchEvent(
      new CustomEvent('mf:add-to-cart', {
        detail: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
        },
      })
    );
  };

  return (
    <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden' }}>
        <img
          src={product.image}
          alt={product.name}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
      <CardHeader style={{ padding: '0.75rem' }}>
        <CardTitle style={{ fontSize: '1rem' }}>{product.name}</CardTitle>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{product.category}</p>
      </CardHeader>
      <CardContent style={{ padding: '0 0.75rem', flex: 1 }}>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{product.description}</p>
      </CardContent>
      <CardFooter style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
          ${product.price.toFixed(2)}
        </span>
        <Button size="sm" onClick={handleAddToCart}>
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
}
