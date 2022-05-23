import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { useCounter } from 'hooks/use-counter';

describe('useCounter when render-hook', () => {
  it('inc', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current[1].inc(1);
    });

    expect(result.current[0]).toEqual(1);
  });
  it('dec', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current[1].dec(1);
    });

    expect(result.current[0]).toEqual(-1);
  });
  it('set', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current[1].set(2);
    });

    expect(result.current[0]).toEqual(2);
  });
  it('reset', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current[1].inc(2);
      result.current[1].reset();
    });

    expect(result.current[0]).toEqual(0);
  });

  it('works with max', () => {
    const { result } = renderHook(() => useCounter(100, { max: 10 }));

    expect(result.current[0]).toEqual(10);

    act(() => {
      result.current[1].inc(1);
    });
    expect(result.current[0]).toEqual(10);
  });
  it('works with min', () => {
    const { result } = renderHook(() => useCounter(0, { min: 10 }));

    expect(result.current[0]).toEqual(10);

    act(() => {
      result.current[1].dec(1);
    });
    expect(result.current[0]).toEqual(10);
  });
});
