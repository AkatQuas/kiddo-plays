/**
 * User Menu Component - Exposed via Module Federation
 * User avatar with dropdown menu
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@mf-monorepo/ui';
import { User, LogIn, UserPlus, X } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

type DropdownView = 'none' | 'login' | 'register' | 'profile';

export default function UserMenu() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<DropdownView>('none');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [user] = useState({
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen('none');
      }
    };

    if (dropdownOpen !== 'none') {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setDropdownOpen('none');
  };

  const handleRegister = () => {
    setIsLoggedIn(true);
    setDropdownOpen('none');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setDropdownOpen('none');
  };

  const openLogin = () => setDropdownOpen('login');
  const openRegister = () => setDropdownOpen('register');

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {isLoggedIn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src={user.avatar}
            alt={user.name}
            onClick={() => setDropdownOpen(dropdownOpen === 'profile' ? 'none' : 'profile')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '2px solid #e5e7eb',
              cursor: 'pointer',
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" onClick={openLogin}>
            <LogIn size={16} style={{ marginRight: '0.25rem' }} />
            Sign In
          </Button>
          <Button size="sm" onClick={openRegister}>
            <UserPlus size={16} style={{ marginRight: '0.25rem' }} />
            Register
          </Button>
        </div>
      )}

      {/* Floating Dropdown */}
      {dropdownOpen !== 'none' && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setDropdownOpen('none')}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
              zIndex: 1,
            }}
          >
            <X size={18} />
          </button>

          {dropdownOpen === 'login' && (
            <div style={{ padding: '1rem' }}>
              <LoginForm onLogin={handleLogin} onCancel={() => setDropdownOpen('none')} />
            </div>
          )}

          {dropdownOpen === 'register' && (
            <div style={{ padding: '1rem' }}>
              <RegisterForm onRegister={handleRegister} onCancel={() => setDropdownOpen('none')} />
            </div>
          )}

          {dropdownOpen === 'profile' && isLoggedIn && (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <img
                src={user.avatar}
                alt={user.name}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  border: '3px solid #e5e7eb',
                  marginBottom: '0.75rem',
                }}
              />
              <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{user.name}</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>{user.email}</p>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
