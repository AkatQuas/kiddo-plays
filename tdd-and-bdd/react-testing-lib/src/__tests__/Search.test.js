import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Search from '../components/Search';

describe('Search', () => {
  test('render label successfully', () => {
    render(<Search>SEARCH</Search>);
    expect(screen.queryByText(/SEARCH/)).toBeInTheDocument();
  });

  test('calls the onChange callback', () => {
    const onChange = jest.fn();

    render(
      <Search value="" onChange={onChange}>
        Search:
      </Search>
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'JavaScript' },
    });
    //    ^ trigger only once

    expect(onChange).toHaveBeenCalledTimes(1);

    userEvent.type(screen.getByRole('textbox'), 'Javascript');
    //    ^ trigger every key stroke

    expect(onChange).toHaveBeenCalledTimes(11);
  });
});
