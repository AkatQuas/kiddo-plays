import { cartReducer, CART_FEATURE_KEY } from '@acme/cart/data-access';
import { configureStore } from '@reduxjs/toolkit';

export function createStore() {
  return configureStore({
    reducer: { [CART_FEATURE_KEY]: cartReducer },
    // Additional middleware can be passed to this array
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
    devTools: process.env['NODE_ENV'] !== 'production',
    // Optional Redux store enhancers
    enhancers: [],
  });
}
