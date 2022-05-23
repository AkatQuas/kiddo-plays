import { fireEvent, screen } from '@testing-library/react';
import { User } from 'components/user';
import { rest } from 'msw';
import React from 'react';
import { server } from '../../mock-server/server';
import { render } from '../../render';

const setupHttp = (name: string = 'Eve', age: number = 10) => {
  server.use(
    rest.get('https://any-site.com/api/info', async (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          id: '1',
          name,
          age,
          role: 'user',
        })
      );
    })
  );
};

describe('User', () => {
  it('click to fetch user info', async () => {
    setupHttp('Mary', 20);

    render(<User />, {
      preloadedState: {
        user: {
          id: '',
          name: '',
          age: 10,
          role: 'user',
          status: 'loading',
        },
      },
    });

    expect(screen.getByText('No information')).toBeInTheDocument();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('User Info')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Load User'));

    expect(await screen.findByText(/id: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/name: mary/i)).toBeInTheDocument();
    expect(screen.getByText(/age: 20/i)).toBeInTheDocument();

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
