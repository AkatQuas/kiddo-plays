/**
 * Login Form Component - Exposed via Module Federation
 * Authentication form with validation
 */

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mf-monorepo/ui';
import { LogIn } from 'lucide-react';

interface LoginFormProps {
  onLogin: () => void;
  onCancel: () => void;
}

export default function LoginForm({ onLogin, onCancel }: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (formData.email && formData.password) {
      onLogin();
    } else {
      setError('Please fill in all fields');
    }
    setIsLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Card style={{ maxWidth: '400px', margin: '0 auto' }}>
      <CardHeader>
        <CardTitle style={{ textAlign: 'center' }}>Welcome Back</CardTitle>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
          Sign in to your account
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="button" variant="outline" onClick={onCancel} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} style={{ flex: 1 }}>
                {isLoading ? (
                  'Signing in...'
                ) : (
                  <>
                    <LogIn size={16} style={{ marginRight: '0.25rem' }} />
                    Sign In
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
