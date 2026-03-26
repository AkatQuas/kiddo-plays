/**
 * User Context - Shared state management for user authentication
 * Used across host and remote apps via Module Federation
 */

import { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserContextType, UserProviderProps } from '@mf-monorepo/types';

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock user for demo purposes
const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
};

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = user !== null;

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUser({ ...mockUser, email });
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const register = useCallback(async (name: string, email: string, _password: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUser({ ...mockUser, name, email });
    setIsLoading(false);
  }, []);

  const value: UserContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;

// Re-export types for convenience
export type { User, UserContextType, UserProviderProps } from '@mf-monorepo/types';
