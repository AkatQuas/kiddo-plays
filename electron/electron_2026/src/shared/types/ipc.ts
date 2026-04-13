/** biome-ignore-all lint/suspicious/noConfusingVoidType: just type annotation */
/**
 * Type-safe IPC channel definitions
 *
 * Define your IPC channels here with their argument and return types.
 * This provides full type inference across main, preload, and renderer.
 */

import type { IpcMainInvokeEvent, IpcRendererEvent } from 'electron'
import type { NavigateOptions } from 'react-router-dom'
import type { EmptyObject } from 'type-fest'
import type { AppRouteName } from '../constants/routes'
import type { HttpRequestOptions, HttpResponse } from './http'
import type { PartialSettingsStore, SettingsStore } from './store'
import type { ProgressInfo, UpdateCheckResult, UpdateInfo } from './update'

// ============================================================================
// Result Types
// ============================================================================

/**
 * Success response with data
 */
export type IpcSuccess<T> = {
  ok: true
  data: T
}

/**
 * Error response with message
 */
export type IpcError<E = string> = {
  ok: false
  error: E
}

/**
 * Generic IPC result - use for operations that can fail
 *
 * @example
 * // Handler returns:
 * return { ok: true, data: user }
 * // Or:
 * return { ok: false, error: 'User not found' }
 *
 * // Renderer handles:
 * const result = await App.invoke('get-user')
 * if (result.ok) {
 *   console.log(result.data)
 * } else {
 *   console.error(result.error)
 * }
 */
export type IpcResult<T, E = string> = IpcSuccess<T> | IpcError<E>

/**
 * Simple success response (no data returned)
 */
export type IpcOk = IpcSuccess<void>

/**
 * Check if IPC result is successful
 */
export function isIpcSuccess<T, E>(
  result: IpcResult<T, E>
): result is IpcSuccess<T> {
  return result.ok === true
}

/**
 * ipcRenderer invoke channel
 * ipcMain register event to handle
 *
 * Return types should use IpcResult<T> for operations that can fail,
 * or direct types for read-only queries that don't fail meaningfully.
 */
export interface InvokeMap {
  // i18n
  'i18n.get-language': { return: string }
  'i18n.set-language': { args: string }

  // Settings
  'settings.get': { return: SettingsStore }
  'settings.set': { args: PartialSettingsStore; return: SettingsStore }

  // Auth
  'auth.get-status': { return: { isLoggedIn: boolean } }
  'auth.login': {
    args: { email: string; password: string }
  }
  'auth.logout': EmptyObject
  // JWT stays in main process, not exposed to renderer
  // Main process will add JWT to HTTP requests internally

  // Utilities
  ping: EmptyObject

  // Updater
  'updater.check': { return: UpdateCheckResult | null }
  'updater.download': EmptyObject
  'updater.install': EmptyObject

  // HTTP Proxy (bypasses CORS)
  'http.request': {
    args: HttpRequestOptions
    return: HttpResponse
  }
}

/** Union of all channel names */
export type InvokeChannel = keyof InvokeMap

/** Argument types for a specific channel */
export type InvokeArgs<C extends InvokeChannel> = InvokeMap[C] extends {
  args: infer A
}
  ? A extends unknown[]
    ? A
    : [A]
  : []

/** Unwrapped return type - the actual result type from handler */
export type InvokeResult<C extends InvokeChannel> = InvokeMap[C] extends {
  return: infer R
}
  ? R
  : unknown

/**
 * Handler type for main process
 * Handler returns data directly, throws on error
 * registerMainHandle auto-catches and wraps in IpcResult
 *
 * @example
 * // Simple - return data, throw on error
 * async () => { if (!ok) throw new Error('fail'); return { token: 'abc' } }
 */
export type InvokeHandler<C extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: InvokeArgs<C>
) => Promise<InvokeResult<C>> | InvokeResult<C>

/**
 * Result type for renderer process
 * Consistent format: { ok: true, data: T } or { ok: false, error: E }
 */
export type InvokeResponse<C extends InvokeChannel> = Promise<
  IpcResult<InvokeResult<C>>
>

/**
 * main send to renderer through webview.webContents.send
 * webview on / once to listen and handle
 * key - Arg
 * key - [Arg1, Arg2]
 */
export interface EventMap {
  'update-available': UpdateInfo
  'update-not-available': void
  'download-progress': ProgressInfo
  'update-downloaded': UpdateInfo
  'update-error': string
  'i18n.language-changed': string
  navigate: [AppRouteName, NavigateOptions?]
  'settings.changed': SettingsStore
  'network.status': { isOnline: boolean; isServiceReachable: boolean }
}

/** Union of all channel names */
export type EventChannel = keyof EventMap

/** Argument types for a specific channel */
export type EventArgs<
  C extends EventChannel,
  A = EventMap[C],
> = A extends unknown[] ? A : [A]

export type EventSender<C extends EventChannel = EventChannel> = (
  channel: C,
  data: EventArgs<C>
) => void

/** Raw Handler function type for a channel */
export type EventRawHandler<C extends EventChannel> = (
  event: IpcRendererEvent,
  ...args: EventArgs<C>
) => void

/** Callback function type for a channel */
export type EventCallback<C extends EventChannel> = (
  ...args: EventArgs<C>
) => void
