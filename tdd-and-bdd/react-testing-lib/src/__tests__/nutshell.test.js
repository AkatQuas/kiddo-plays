import sum from '../lib/sum';

describe('true is truthy and false is falsy', () => {
  test('true is truthy', () => {
    expect(true).toBe(true);
  });

  test('false is falsy', () => {
    expect(false).toBe(false);
  });
});

describe('sum', () => {
  test('sum up two values', () => {
    expect(sum(2, 3)).toBe(5);
  });
});
