import type { CookieStoreSchema, UserStoreSchema } from '@shared/types/store';
import { createLazySingletonStore } from '../factory/store';

/**
 * User store for persisting authentication and user data
 */
export const userStore = createLazySingletonStore<UserStoreSchema>('user', {
  userId: null,
});

/**
 * Cookie store for persisting web session cookies
 */
export const cookieStore = createLazySingletonStore<CookieStoreSchema>('cookies', {});
