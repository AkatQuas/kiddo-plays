/**
 * @mf-monorepo/types - Shared TypeScript types for the Module Federation Monorepo
 *
 * This package provides common type definitions used across all apps and packages.
 * It ensures type consistency and enables better developer experience with IDE support.
 */

// Re-export types
export type { CartItem, CartContextType, CartProviderProps } from './types/cart';
export type { User, UserContextType, UserProviderProps, UserProfile } from './types/user';
export type { Product, ProductCardProps, ProductDetailProps, ProductsListProps } from './types/product';

// Re-export constants
export { MF_EVENTS, DEFAULT_PORTS, API_ENDPOINTS, STORAGE_KEYS } from './constants';
export type { MFEventName } from './constants';

// Default exports for convenience
export type { CartItem as default } from './types/cart';
