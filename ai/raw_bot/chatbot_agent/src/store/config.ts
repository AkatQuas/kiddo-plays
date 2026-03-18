import { create } from 'zustand';
import { localStoragePersistence } from '../persistence/local_storage';
import type { AppConfig, LLMConfig } from '../types/config';

type ConfigState = {
  config: AppConfig;
  hasConfig: boolean;
  isLoading: boolean;

  // Actions
  setConfig: (config: Partial<AppConfig>) => Promise<void>;
  setLLMConfig: (llmConfig: Partial<LLMConfig>) => Promise<void>;
  loadConfig: () => Promise<void>;
  resetConfig: () => Promise<void>;
};

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
  llmConfig: {
    model: '',
    apiKey: '',
    baseUrl: '',
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.7
  },
  userPrompt: '',
  longTermMemoryEnabled: false
};

export const configStore = create<ConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  hasConfig: false,
  isLoading: false,

  setConfig: async (configUpdates) => {
    const currentConfig = get().config;
    const newConfig = { ...currentConfig, ...configUpdates };

    // Save to localStorage
    await localStoragePersistence.write('app_config', newConfig);

    set({
      config: newConfig,
      hasConfig: !!newConfig.llmConfig.apiKey
    });
  },

  setLLMConfig: async (llmConfigUpdates) => {
    const currentConfig = get().config;
    const newLLMConfig = { ...currentConfig.llmConfig, ...llmConfigUpdates };
    const newConfig = { ...currentConfig, llmConfig: newLLMConfig };

    // Save to localStorage
    await localStoragePersistence.write('app_config', newConfig);

    set({
      config: newConfig,
      hasConfig: !!newLLMConfig.apiKey
    });
  },

  loadConfig: async () => {
    set({ isLoading: true });

    try {
      // Load from localStorage
      const savedConfig =
        await localStoragePersistence.read<AppConfig>('app_config');

      if (savedConfig) {
        set({
          config: { ...DEFAULT_CONFIG, ...savedConfig },
          hasConfig: !!savedConfig.llmConfig.apiKey
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  resetConfig: async () => {
    await localStoragePersistence.write('app_config', DEFAULT_CONFIG);
    set({
      config: DEFAULT_CONFIG,
      hasConfig: false
    });
  }
}));
