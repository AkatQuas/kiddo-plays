/** biome-ignore-all lint/suspicious/noConfusingVoidType: just type annotation */
/**
 * Type-safe IPC channel definitions
 *
 * Define your IPC channels here with their argument and res types.
 * This provides full type inference across main, preload, and renderer.
 */

// Import types for use in this file
import type { SettingStoreSchema } from '@shared/types/store';
import type { IpcMainInvokeEvent, IpcRendererEvent } from 'electron';
import type { EmptyObject } from 'type-fest';

// ============================================================================
// IPC Channel Definitions
// ============================================================================

/**
 * Success response with data
 */
export type IpcSuccess<T> = {
  ok: true;
  data: T;
};

/**
 * Error response with message
 */
export type IpcError<E = string> = {
  ok: false;
  error: E;
};

/**
 * Generic IPC result - use for operations that can fail
 *
 * @example
 * // Handler ress:
 * res { ok: true, data: user }
 * // Or:
 * res { ok: false, error: 'User not found' }
 *
 * // Renderer handles:
 * const result = await App.invoke('get-user')
 * if (result.ok) {
 *   console.log(result.data)
 * } else {
 *   console.error(result.error)
 * }
 */
export type IpcResult<T, E = string> = IpcSuccess<T> | IpcError<E>;

/**
 * Simple success response (no data resed)
 */
export type IpcOk = IpcSuccess<void>;

/**
 * Check if IPC result is successful
 */
export function isIpcSuccess<T, E>(result: IpcResult<T, E>): result is IpcSuccess<T> {
  return result.ok === true;
}

/**
 * ipcRenderer invoke channel
 * ipcMain register event to handle
 *
 * res types should use IpcResult<T> for operations that can fail,
 * or direct types for read-only queries that don't fail meaningfully.
 */
export interface InvokeMap {
  // i18n
  'i18n.get-language': { res: string };
  'i18n.set-language': { args: string };

  'settings.proxy': { res: SettingStoreSchema['proxy'] };
  'settings.proxy.update': { args: SettingStoreSchema['proxy'] };

  // App
  'app.platform': { res: 'windows' | 'macos' };

  // Auth
  'auth.login': {
    args: {
      password: string;
      email: string;
    };
  };
  'auth.logout': EmptyObject;

  // Window controls
  'window.minimize': EmptyObject;
  'window.maximize': EmptyObject;
  'window.close': EmptyObject;
  'window.show-main': EmptyObject;
  'window.is-maximized': { res: boolean };

  'window.open_external': {
    args: { url: string; title?: string; width?: number; height?: number };
  };

  // Utilities
  ping: EmptyObject;
}

/** Union of all channel names */
export type InvokeChannel = keyof InvokeMap;

/** Argument types for a specific channel */
export type InvokeArgs<C extends InvokeChannel> = InvokeMap[C] extends {
  args: infer A;
}
  ? A extends unknown[]
    ? A
    : [A]
  : [];

/** Unwrapped res type - the actual result type from handler */
export type InvokeResult<C extends InvokeChannel> = InvokeMap[C] extends {
  res: infer R;
}
  ? R
  : unknown;

/**
 * Handler type for main process
 * Handler ress data directly, throws on error
 * registerMainHandle auto-catches and wraps in IpcResult
 *
 * @example
 * // Simple - res data, throw on error
 * async () => { if (!ok) throw new Error('fail'); res { token: 'abc' } }
 */
export type InvokeHandler<C extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: InvokeArgs<C>
) => Promise<InvokeResult<C>> | InvokeResult<C>;

/**
 * Result type for renderer process
 * Consistent format: { ok: true, data: T } or { ok: false, error: E }
 */
export type InvokeResponse<C extends InvokeChannel> = Promise<IpcResult<InvokeResult<C>>>;

/**
 * main send to renderer through webview.webContents.send
 * webview on / once to listen and handle
 * key - Arg
 * key - [Arg1, Arg2]
 */
export interface EventMap {
  'i18n.language-changed': string;
  'network.status': { isOnline: boolean; isServiceReachable: boolean };
}

/** Union of all channel names */
export type EventChannel = keyof EventMap;

/** Argument types for a specific channel */
export type EventArgs<C extends EventChannel, A = EventMap[C]> = A extends unknown[] ? A : [A];

export type EventSender<C extends EventChannel = EventChannel> = (
  channel: C,
  data: EventArgs<C>
) => void;

/** Raw Handler function type for a channel */
export type EventRawHandler<C extends EventChannel> = (
  event: IpcRendererEvent,
  ...args: EventArgs<C>
) => void;

/** Callback function type for a channel */
export type EventCallback<C extends EventChannel> = (...args: EventArgs<C>) => void;
