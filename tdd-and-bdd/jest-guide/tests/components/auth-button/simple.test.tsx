import { render, screen } from '@testing-library/react';
import { AuthButton } from 'components/auth-button';
import React from 'react';

describe('AuthButton', () => {
  it('Render well', () => {
    render(<AuthButton>Login</AuthButton>);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
