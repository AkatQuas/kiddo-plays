/*
 * Test by mock axios module
 */
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import { AuthButton } from 'components/auth-button';
import React from 'react';

describe('AuthButton when mock axios module', () => {
  it('works when User', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { role: 'user' },
    });

    render(<AuthButton>Halo</AuthButton>);

    expect(screen.getByText('Halo')).toBeInTheDocument();
    expect(await screen.findByText('Role: User')).toBeInTheDocument();
  });
  it('works when Admin', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { role: 'admin' },
    });

    render(<AuthButton>Halo</AuthButton>);

    expect(await screen.findByText('Role: Admin')).toBeInTheDocument();
  });
});
