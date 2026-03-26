/**
 * Product Types - Shared product-related type definitions
 */

import type { CartItem } from './cart';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
}

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Omit<CartItem, 'quantity'>) => void;
}

export interface ProductDetailProps {
  product: Product;
}

export interface ProductsListProps {
  category?: string;
}
