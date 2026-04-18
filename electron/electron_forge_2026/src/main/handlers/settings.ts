import { session } from 'electron';
import { settingsStore } from '../stores/settingsStore';
import { applySessionProxy } from '../utils/session';
import { registerMainHandle } from './register';

export function registerSettingsHandlers() {
  registerMainHandle('settings.proxy', async () => {
    const proxy = settingsStore.get('proxy', null);
    return proxy;
  });

  registerMainHandle('settings.proxy.update', async (_, proxy) => {
    try {
      await applySessionProxy(proxy);
      settingsStore.set('proxy', proxy);
    } catch (error) {
      // Re-apply system proxy on failure
      session.defaultSession.setProxy({ mode: 'system' });
      settingsStore.set('proxy', { enable: false, url: '', port: '' });
      throw error;
    }
  });
}
