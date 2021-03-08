import { act, renderHook } from '@testing-library/react-hooks';
import useCounter from '../useCounter';

test('should increment counter', () => {
  const { result } = renderHook(() => useCounter(0));
  expect(result.current.count).toBe(0);
  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});

test('should increment counter with initial count', () => {
  const { result, rerender } = renderHook(
    ({ initialValue }) => useCounter(initialValue),
    { initialProps: { initialValue: 20 } }
  );

  expect(result.current.count).toBe(20);
  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(21);

  rerender({ initialValue: 10 });
  act(() => {
    result.current.reset();
  });

  expect(result.current.count).toBe(10);
});
