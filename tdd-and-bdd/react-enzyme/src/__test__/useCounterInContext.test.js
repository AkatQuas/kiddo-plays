import { act, renderHook } from '@testing-library/react-hooks';
import React from 'react';
import { CounterStepProvider, useCounter } from '../useCounterInContext';

test('should use custom step when incrementing', () => {
  const wrapper = ({ children }) => (
    <CounterStepProvider step={2}>{children}</CounterStepProvider>
  );

  const { result } = renderHook(() => useCounter(), { wrapper });

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(2);
});

test('should use custom step when incrementing with initialValue', () => {
  const wrapper = ({ children, step }) => (
    <CounterStepProvider step={step}>{children}</CounterStepProvider>
  );

  const { result, rerender } = renderHook(() => useCounter(), {
    wrapper,
    initialProps: {
      step: 3,
    },
  });

  act(() => {
    result.current.increment();
  });
  expect(result.current.count).toBe(3);
  /**
   * Change the step value
   */
  rerender({ step: 8 });
  act(() => {
    result.current.increment();
  });
  expect(result.current.count).toBe(11);
});

test('should increment counter after delay', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useCounter());

  result.current.incrementAsync();

  await waitForNextUpdate();

  expect(result.current.count).toBe(1);
});
