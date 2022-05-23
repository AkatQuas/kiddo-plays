import { useState } from 'react';

export interface CounterOptions {
  min?: number;
  max?: number;
}

export type ValueParam = number | ((c: number) => number);

function getTargetValue(value: number, options: CounterOptions) {
  const { min, max } = options;

  let target = value;

  if (typeof max === 'number') {
    target = Math.min(max, target);
  }
  if (typeof min == 'number') {
    target = Math.max(min, target);
  }
  return target;
}

export const useCounter = (initialValue = 0, options: CounterOptions = {}) => {
  const [current, setCurrent] = useState(() =>
    getTargetValue(initialValue, options)
  );

  const setValue = (v: ValueParam) => {
    setCurrent((c) => {
      const next = typeof v === 'number' ? v : v(c);
      return getTargetValue(next, options);
    });
  };

  return [
    current,
    {
      inc: (delta = 1) => {
        setValue((c) => c + delta);
      },
      dec: (delta = 1) => {
        setValue((c) => c - delta);
      },
      set: (v: ValueParam) => {
        setValue(v);
      },
      reset: () => {
        setValue(initialValue);
      },
    },
  ] as const;
};
