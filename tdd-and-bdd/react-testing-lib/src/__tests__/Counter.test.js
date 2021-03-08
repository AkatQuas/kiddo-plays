import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Counter from '../components/Counter';

describe('Counter', () => {
  test('render Counter with initialValue', async () => {
    render(<Counter initialValue={4} />);
    expect(screen.queryByText(/value: 4/)).toBeInTheDocument();

    fireEvent.click(screen.queryByText(/Increment/));

    expect(screen.queryByText(/value: 5/)).toBeInTheDocument();

    // Whenever possible, use userEvent over fireEvent
    // when using React Testing Library.
    userEvent.click(screen.queryByText(/Increment/));
    expect(screen.queryByText(/value: 6/)).toBeInTheDocument();
  });
});
