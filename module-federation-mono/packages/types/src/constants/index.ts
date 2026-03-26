/**
 * Event Names - Custom event names for Module Federation communication
 */

export const MF_EVENTS = {
  ADD_TO_CART: 'mf:add-to-cart',
  REMOVE_FROM_CART: 'mf:remove-from-cart',
  UPDATE_CART: 'mf:update-cart',
  CLEAR_CART: 'mf:clear-cart',
  USER_LOGIN: 'mf:user-login',
  USER_LOGOUT: 'mf:user-logout',
} as const;

export type MFEventName = (typeof MF_EVENTS)[keyof typeof MF_EVENTS];

/**
 * Default Ports - Development server ports for each app
 */
export const DEFAULT_PORTS = {
  HOST: 3000,
  PRODUCTS: 3001,
  CART: 3002,
  USER: 3003,
} as const;

/**
 * API Endpoints - Mock API paths
 */
export const API_ENDPOINTS = {
  PRODUCTS: '/api/products',
  CART: '/api/cart',
  USER: '/api/user',
  AUTH: '/api/auth',
} as const;

/**
 * Storage Keys - Local storage keys
 */
export const STORAGE_KEYS = {
  CART: 'mf-cart-items',
  USER: 'mf-user-session',
  PREFERENCES: 'mf-user-preferences',
} as const;
