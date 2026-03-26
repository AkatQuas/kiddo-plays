/**
 * Product Detail Component - Exposed via Module Federation
 */

import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@mf-monorepo/ui';
import type { Product } from './ProductsList';

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const handleAddToCart = () => {
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
    <Card style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ position: 'relative', paddingTop: '60%', overflow: 'hidden' }}>
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
      <CardHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <CardTitle style={{ fontSize: '1.5rem' }}>{product.name}</CardTitle>
          <Badge variant="secondary">{product.category}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '1rem' }}>
          {product.description}
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>
          ${product.price.toFixed(2)}
        </p>
      </CardContent>
      <CardContent style={{ display: 'flex', gap: '0.5rem' }}>
        <Button onClick={handleAddToCart} style={{ flex: 1 }}>
          Add to Cart
        </Button>
        <Button variant="outline" style={{ flex: 1 }}>
          Buy Now
        </Button>
      </CardContent>
    </Card>
  );
}
