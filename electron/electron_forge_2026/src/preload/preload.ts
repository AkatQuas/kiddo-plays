// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import type {
  EventCallback,
  EventChannel,
  EventRawHandler,
  InvokeArgs,
  InvokeChannel,
  InvokeResponse,
} from '@shared/types/ipc';
import { contextBridge, ipcRenderer } from 'electron';

declare global {
  interface Window {
    App: typeof API;
  }
}

const API = {
  /**
   * Invoke a handler in main process and get return value
   */
  invoke: <C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): InvokeResponse<C> => {
    return ipcRenderer.invoke(channel, ...args);
  },
  /**
   * Listen for events from main process
   */
  on: <C extends EventChannel>(channel: C, callback: EventCallback<C>) => {
    const subscription: EventRawHandler<C> = (_event, ...args) => {
      callback(...args);
    };
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  /**
   * Listen for a single event from main process
   */
  once: <C extends EventChannel>(channel: C, callback: EventCallback<C>) => {
    ipcRenderer.once(channel, ((_event, ...args) => {
      callback(...args);
    }) as EventRawHandler<C>);
  },
  /**
   * Remove all listeners for a channel
   */
  off: <C extends EventChannel>(channel: C, callback?: EventCallback<C>) => {
    if (callback) {
      ipcRenderer.removeListener(channel, callback as any);
    } else {
      ipcRenderer.removeAllListeners(channel);
    }
  },
};

contextBridge.exposeInMainWorld('App', API);
