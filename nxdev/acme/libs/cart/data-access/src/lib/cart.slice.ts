import { ICartItem } from '@acme/shared-modules';
import {
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
  createSlice,
  EntityState,
  PayloadAction,
} from '@reduxjs/toolkit';
import { checkout } from './cart-data-access';

export const CART_FEATURE_KEY = 'cart';

export interface CartState extends EntityState<ICartItem> {
  loadingStatus: 'ready' | 'pending' | 'ordered' | 'error';
  error: string | null;
  order?: string;
}

/**
 * {@link createEntityAdapter} function returns a set of
 * case reducers and selectors that makes
 * working with normalized entities much simpler
 */
export const cartAdapter = createEntityAdapter<ICartItem>();

/**
 * {@link createAsyncThunk} function returns a thunk
 * that allows us to handle async dataflow.

 * Export an effect using createAsyncThunk from
 * the Redux Toolkit: https://redux-toolkit.js.org/api/createAsyncThunk
 *
 * @example
 * ```
 * import React, { useEffect } from 'react';
 * import { useDispatch } from 'react-redux';
 *
 * // ...
 *
 * const dispatch = useDispatch();
 * useEffect(() => {
 *   dispatch(checkoutCart(items))
 * }, [dispatch]);
 * ```
 */
export const checkoutCart = createAsyncThunk<{ order: string }, ICartItem[]>(
  'cart/checkoutStatus',
  (items) => checkout({ items })
);

export const initialCartState: CartState = cartAdapter.getInitialState({
  loadingStatus: 'ready',
  error: null,
});

/**
 * {@link createSlice} function removes
 * much of the boilerplate of Redux
 * by allowing us to define the actions and case reducers together.
 */
export const cartSlice = createSlice({
  name: CART_FEATURE_KEY,
  initialState: initialCartState,
  reducers: {
    add: cartAdapter.addOne,
    remove: cartAdapter.removeOne,
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkoutCart.pending, (state: CartState) => {
        state.loadingStatus = 'pending';
      })
      .addCase(
        checkoutCart.fulfilled,
        (state: CartState, action: PayloadAction<{ order: string }>) => {
          state.loadingStatus = 'ordered';
          state.order = action.payload.order;
        }
      )
      .addCase(checkoutCart.rejected, (state: CartState, action) => {
        state.loadingStatus = 'error';
        state.error = action.error.message ?? null;
      });
  },
});

/*
 * Export reducer for store configuration.
 */
export const cartReducer = cartSlice.reducer;

/*
 * Export action creators to be dispatched. For use with the `useDispatch` hook.
 *
 * e.g.
 * ```
 * import React, { useEffect } from 'react';
 * import { useDispatch } from 'react-redux';
 *
 * // ...
 *
 * const dispatch = useDispatch();
 * useEffect(() => {
 *   dispatch(cartActions.add({ id: 1 }))
 * }, [dispatch]);
 * ```
 *
 * See: https://react-redux.js.org/next/api/hooks#usedispatch
 */
export const cartActions = cartSlice.actions;

/*
 * Export selectors to query state. For use with the `useSelector` hook.
 *
 * e.g.
 * ```
 * import { useSelector } from 'react-redux';
 *
 * // ...
 *
 * const entities = useSelector(selectAllCart);
 * ```
 *
 * See: https://react-redux.js.org/next/api/hooks#useselector
 */
const { selectAll, selectEntities } = cartAdapter.getSelectors();

export const getCartState = <T extends { [CART_FEATURE_KEY]: CartState }>(
  rootState: T
): CartState => rootState[CART_FEATURE_KEY];

export const selectCartItems = createSelector(getCartState, selectAll);

export const selectCartStatus = createSelector(
  getCartState,
  (state) => state.loadingStatus
);

export const selectCartOrder = createSelector(
  getCartState,
  (state) => state.order
);

export const selectTotal = createSelector(selectCartItems, (items) =>
  items.reduce((total, it) => total + it.cost, 0)
);
