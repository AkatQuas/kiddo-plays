import { create } from 'zustand';
import { isInitialized, getConfig, updateConfig } from '@/src/db/repositories/config-repository';

interface AppStore {
  currentMode: 'order' | 'manage';
  isInitialized: boolean;
  disclaimerAccepted: boolean;
  onboardingCompleted: boolean;
  isDrawerOpen: boolean;
  isAuthenticating: boolean;
  isLoading: boolean;
  authTimeoutId: ReturnType<typeof setTimeout> | null;

  checkInitialized: () => Promise<void>;
  setMode: (mode: 'order' | 'manage') => void;
  setDrawerOpen: (open: boolean) => void;
  setAuthenticating: (v: boolean) => void;
  setDisclaimerAccepted: () => Promise<void>;
  setOnboardingCompleted: () => Promise<void>;
  startAuthTimeout: (onTimeout: () => void, seconds?: number) => void;
  clearAuthTimeout: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentMode: 'order',
  isInitialized: false,
  disclaimerAccepted: false,
  onboardingCompleted: false,
  isDrawerOpen: false,
  isAuthenticating: false,
  isLoading: true,
  authTimeoutId: null,

  checkInitialized: async () => {
    set({ isLoading: true });
    try {
      const initialized = await isInitialized();
      if (initialized) {
        const config = await getConfig();
        set({
          isInitialized: true,
          disclaimerAccepted: config?.disclaimer_accepted === 1,
          onboardingCompleted: config?.onboarding_completed === 1,
        });
      } else {
        set({ isInitialized: false });
      }
    } catch (e) {
      console.error('checkInitialized error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setMode: (mode) => set({ currentMode: mode }),

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),

  setAuthenticating: (v) => set({ isAuthenticating: v }),

  setDisclaimerAccepted: async () => {
    await updateConfig({ disclaimer_accepted: 1 });
    set({ disclaimerAccepted: true });
  },

  setOnboardingCompleted: async () => {
    await updateConfig({ onboarding_completed: 1 });
    set({ onboardingCompleted: true });
  },

  startAuthTimeout: (onTimeout, seconds) => {
    get().clearAuthTimeout();
    const id = setTimeout(onTimeout, (seconds ?? 300) * 1000);
    set({ authTimeoutId: id });
  },

  clearAuthTimeout: () => {
    const id = get().authTimeoutId;
    if (id) {
      clearTimeout(id);
      set({ authTimeoutId: null });
    }
  },
}));