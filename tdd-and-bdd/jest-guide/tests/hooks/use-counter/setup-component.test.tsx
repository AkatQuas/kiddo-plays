import { act, render } from '@testing-library/react';
import { useCounter } from 'hooks/use-counter';
import React from 'react';

type X = ReturnType<typeof useCounter>;

interface CounterMock {
  counter: X[0];
  utils: X[1];
}

const setup = (initialValue: number) => {
  const ret = {} as CounterMock;

  const UseCounterTest = () => {
    const [counter, utils] = useCounter(initialValue);

    Object.assign(ret, {
      counter,
      utils,
    });

    /* no jsx return! */
    return null;
  };

  render(<UseCounterTest />);

  return ret;
};
describe('useCounter when setup', () => {
  it('inc', async () => {
    const useCounterData = setup(0);

    act(() => {
      useCounterData.utils.inc(1);
    });

    expect(useCounterData.counter).toEqual(1);
  });

  it('dec', async () => {
    const useCounterData = setup(0);

    act(() => {
      useCounterData.utils.dec(1);
    });

    expect(useCounterData.counter).toEqual(-1);
  });

  it('set', async () => {
    const useCounterData = setup(0);

    act(() => {
      useCounterData.utils.set(10);
    });

    expect(useCounterData.counter).toEqual(10);
  });

  it('reset', async () => {
    const useCounterData = setup(0);

    act(() => {
      useCounterData.utils.inc(1);
      useCounterData.utils.reset();
    });

    expect(useCounterData.counter).toEqual(0);
  });
});
