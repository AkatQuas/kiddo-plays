import { fetchCart, cartAdapter, cartReducer } from './cart.slice';

describe('cart reducer', () => {
  it('should handle initial state', () => {
    const expected = cartAdapter.getInitialState({
      loadingStatus: 'not loaded',
      error: null,
    });

    expect(cartReducer(undefined, { type: '' })).toEqual(expected);
  });

  it('should handle fetchCarts', () => {
    let state = cartReducer(undefined, fetchCart.pending(null, null));

    expect(state).toEqual(
      expect.objectContaining({
        loadingStatus: 'loading',
        error: null,
        entities: {},
      })
    );

    state = cartReducer(state, fetchCart.fulfilled([{ id: 1 }], null, null));

    expect(state).toEqual(
      expect.objectContaining({
        loadingStatus: 'loaded',
        error: null,
        entities: { 1: { id: 1 } },
      })
    );

    state = cartReducer(
      state,
      fetchCart.rejected(new Error('Uh oh'), null, null)
    );

    expect(state).toEqual(
      expect.objectContaining({
        loadingStatus: 'error',
        error: 'Uh oh',
        entities: { 1: { id: 1 } },
      })
    );
  });
});
