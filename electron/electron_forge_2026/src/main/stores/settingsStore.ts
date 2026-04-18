import type { SettingStoreSchema } from '@shared/types/store';
import { createLazySingletonStore } from '../factory/store';

/**
 * Settings store for app-level settings (not user-specific)
 */
export const settingsStore = createLazySingletonStore<SettingStoreSchema>('settings', {
  proxy: null,
});
