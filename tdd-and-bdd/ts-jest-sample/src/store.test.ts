import { getCount, increment, store } from './store';
describe('Store', () => {
  beforeEach(() => {
    store.count = 10;
  });

  test('store', () => {
    expect(store.count).toBe(10);
    increment(20);
    expect(getCount()).toBe(30);
  });
});
