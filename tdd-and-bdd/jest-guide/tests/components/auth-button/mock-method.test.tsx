/*
 * Test by mock some inner function
 */
import { render, screen } from '@testing-library/react';
import * as apiUser from 'apis/user';
import { AuthButton } from 'components/auth-button';
import React from 'react';

describe('AuthButton when mock method', () => {
  it('works when User', async () => {
    jest
      .spyOn(apiUser, 'fetchUserRole')
      .mockResolvedValueOnce({ role: 'user' });
    render(<AuthButton>Halo</AuthButton>);

    expect(await screen.findByText('Role: User')).toBeInTheDocument();
  });
  it('works when Admin', async () => {
    jest
      .spyOn(apiUser, 'fetchUserRole')
      .mockResolvedValueOnce({ role: 'admin' });
    render(<AuthButton>Halo</AuthButton>);

    expect(await screen.findByText('Role: Admin')).toBeInTheDocument();
  });
});
