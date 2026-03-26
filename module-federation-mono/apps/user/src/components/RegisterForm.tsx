/**
 * Register Form Component - Exposed via Module Federation
 * Registration form with validation
 */

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mf-monorepo/ui';
import { UserPlus } from 'lucide-react';

interface RegisterFormProps {
  onRegister: () => void;
  onCancel: () => void;
}

export default function RegisterForm({ onRegister, onCancel }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onRegister();
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
        <CardTitle style={{ textAlign: 'center' }}>Create Account</CardTitle>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
          Join us and start shopping
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                htmlFor="name"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
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
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
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
                  'Creating...'
                ) : (
                  <>
                    <UserPlus size={16} style={{ marginRight: '0.25rem' }} />
                    Register
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
