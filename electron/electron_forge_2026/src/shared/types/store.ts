import type { Cookies } from 'cookie';

/**
 * Settings store schema for app-level settings (not user-specific)
 */
export interface SettingStoreSchema {
  // Proxy settings
  proxy: {
    enable: boolean;
    url: string;
    port: string;
  } | null;
}

/**
 * User store schema for persisting authentication and user data
 */
export interface UserStoreSchema {
  userId: string | null;
}

/**
 * Cookie store for web session cookies
 * Domain -> {@link Cookies} list
 */
export type CookieStoreSchema = Record</** domain */ string, Cookies[]>;
