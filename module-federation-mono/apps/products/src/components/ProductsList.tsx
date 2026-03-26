/**
 * Products List Component - Exposed via Module Federation
 */

import ProductCard from './ProductCard';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
}

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Wireless Headphones',
    price: 99.99,
    description: 'Premium noise-canceling wireless headphones',
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop'
  },
  {
    id: '2',
    name: 'Smart Watch',
    price: 249.99,
    description: 'Advanced fitness tracking smartwatch',
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop'
  },
  {
    id: '3',
    name: 'Running Shoes',
    price: 129.99,
    description: 'Comfortable running shoes with premium cushioning',
    category: 'Sports',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop'
  },
  {
    id: '4',
    name: 'Leather Bag',
    price: 179.99,
    description: 'Genuine leather messenger bag',
    category: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop'
  },
  {
    id: '5',
    name: 'Coffee Maker',
    price: 89.99,
    description: 'Programmable coffee maker with thermal carafe',
    category: 'Home',
    image:
      'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=200&h=200&fit=crop'
  },
  {
    id: '6',
    name: 'Yoga Mat',
    price: 39.99,
    description: 'Non-slip premium yoga mat',
    category: 'Sports',
    image:
      'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=200&h=200&fit=crop'
  }
];

export default function ProductsList() {
  return (
    <div>
      <h2
        style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}
      >
        Featured Products
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem'
        }}
      >
        {mockProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

export { ProductCard };
