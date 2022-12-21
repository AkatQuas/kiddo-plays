import { calculate } from './calculate';

describe('This is a simple test', () => {
  test('calculate ??', () => {
    expect(calculate(2, 3, '+')).toBe(5);
    expect(calculate(3, 2, '-')).toBe(1);
    // @ts-expect-error
    expect(() => calculate(2, 2, '*')).toThrow(/Unknown operator/);
  });
});
