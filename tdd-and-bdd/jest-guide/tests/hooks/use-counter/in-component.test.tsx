import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCounter } from 'hooks/use-counter';
import React from 'react';

const UseCounterTest = () => {
  const [counter, { inc, set, dec, reset }] = useCounter(0);
  return (
    <section>
      <div>Counter: {counter} </div>
      <button onClick={() => inc(1)}>inc 1</button>
      <button onClick={() => dec(1)}>dec 1</button>
      <button onClick={() => set(2)}>set 2</button>
      <button onClick={reset}>reset</button>
    </section>
  );
};

describe('useCounter with component', () => {
  it('add properly', async () => {
    render(<UseCounterTest />);
    await userEvent.click(screen.getByText('inc 1'));
    expect(screen.getByText('Counter: 1')).toBeInTheDocument();
  });
  it('dec properly', async () => {
    render(<UseCounterTest />);
    await userEvent.click(screen.getByText('dec 1'));
    expect(screen.getByText('Counter: -1')).toBeInTheDocument();
  });
  it('set properly', async () => {
    render(<UseCounterTest />);
    await userEvent.click(screen.getByText('set 2'));
    expect(screen.getByText('Counter: 2')).toBeInTheDocument();
  });
  it('reset properly', async () => {
    render(<UseCounterTest />);
    await userEvent.click(screen.getByText('inc 1'));
    await userEvent.click(screen.getByText('reset'));
    expect(screen.getByText('Counter: 0')).toBeInTheDocument();
  });
});
