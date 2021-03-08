import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Story from '../components/Story';

jest.mock('axios');

describe('Story', () => {
  test('render with list from API successfully', async () => {
    render(<Story />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    const stories = [
      { objectID: '1', title: 'Hello' },
      { objectID: '2', title: 'React' },
    ];

    axios.get.mockImplementationOnce(() =>
      Promise.resolve({ data: { hits: stories } })
    );

    userEvent.click(screen.getByRole('button'));
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
  });

  test('fetch stories failed from API', async () => {
    axios.get.mockImplementationOnce(() =>
      Promise.reject(new Error('Internal Server Error'))
    );

    render(<Story />);
    userEvent.click(screen.getByRole('button'));

    expect(
      await screen.findByText(/something went wrong/i)
    ).toBeInTheDocument();
  });
});
