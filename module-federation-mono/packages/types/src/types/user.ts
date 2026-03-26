/**
 * User Types - Shared user-related type definitions
 */

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
}

export interface UserProviderProps {
  children: React.ReactNode;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  address?: string;
}

export type { User as default };
