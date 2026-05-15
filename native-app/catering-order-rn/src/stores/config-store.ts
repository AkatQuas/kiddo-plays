import { create } from 'zustand';
import {
  getConfig,
  updateConfig,
  initializeConfig,
  type SystemConfig,
} from '@/src/db/repositories/config-repository';
import { logOperation } from '@/src/db/repositories/operation-log-repository';
import { hashPassword } from '@/src/services/auth-service';

interface ConfigStore {
  shopName: string;
  tableCount: number;
  bioUnlock: boolean;
  timeoutSeconds: number;
  qrCodePath: string | null;
  isLoading: boolean;

  loadConfig: () => Promise<void>;
  updateShopConfig: (data: Partial<Pick<SystemConfig, 'shop_name' | 'table_num' | 'bio_unlock' | 'timeout_time'>>) => Promise<void>;
  initConfig: (shopName: string, tableCount: number, password: string) => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  shopName: '',
  tableCount: 99,
  bioUnlock: false,
  timeoutSeconds: 300,
  qrCodePath: null,
  isLoading: false,

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await getConfig();
      if (config) {
        set({
          shopName: config.shop_name,
          tableCount: config.table_num,
          bioUnlock: config.bio_unlock === 1,
          timeoutSeconds: config.timeout_time,
        });
      }
    } catch (e) {
      console.error('loadConfig error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateShopConfig: async (data) => {
    await updateConfig(data);
    await logOperation('config_update', JSON.stringify(data));
    const config = await getConfig();
    if (config) {
      set({
        shopName: config.shop_name,
        tableCount: config.table_num,
        bioUnlock: config.bio_unlock === 1,
        timeoutSeconds: config.timeout_time,
      });
    }
  },

  initConfig: async (shopName, tableCount, password) => {
    const hash = await hashPassword(password);
    await initializeConfig({
      shop_name: shopName,
      table_num: tableCount,
      admin_pwd: hash,
    });
    set({ shopName, tableCount });
  },
}));