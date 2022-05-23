import { render, screen } from '@testing-library/react';
import { UserRole } from 'apis/user';
import { AuthButton } from 'components/auth-button';
import { rest } from 'msw';
import React from 'react';
import { server } from '../../mock-server/server';

const setup = (role: UserRole) => {
  server.use(
    // dynamic response
    rest.get('https://any-site.com/api/role', async (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({ role }));
    })
  );
};

describe('AuthButton when mock server', () => {
  it('works when User', async () => {
    setup('user');
    render(<AuthButton>Halo</AuthButton>);

    expect(await screen.findByText('Role: User')).toBeInTheDocument();
  });
  it('works when Admin', async () => {
    setup('admin');
    render(<AuthButton>Halo</AuthButton>);

    expect(await screen.findByText('Role: Admin')).toBeInTheDocument();
  });
});
