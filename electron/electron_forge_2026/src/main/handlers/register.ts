import type { InvokeArgs, InvokeChannel, InvokeHandler } from '@shared/types/ipc';
import { ipcMain } from 'electron';

/**
 * Create a success response
 */
export function ipcSuccess<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

/**
 * Create an error response
 */
export function ipcError<E = string>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

/**
 * Register a typed IPC handler in main process
 * Will automatically catches errors and format error response on {@link handler} failure
 *
 * @param channel - IPC channel name
 * @param handler - Handler function, returns data or just throw error
 *
 * @example
 * // On success: returns your data
 * // On error: throws error
 * registerMainHandle('auth.login', async () => {
 *   const user = await authenticate()
 *   return { token: user.jwt }
 * })
 *
 * // Or simpler - just return data, throw on error:
 * registerMainHandle('auth.login', async () => {
 *   if (!valid) throw new Error('Invalid')
 *   return { token: jwt }
 * })
 */
export function registerMainHandle<C extends InvokeChannel>(
  channel: C,
  handler: InvokeHandler<C>
): void {
  const wrapped = async (
    event: Electron.IpcMainInvokeEvent,
    ...args: InvokeArgs<C>
  ): Promise<
    | {
        ok: true;
        data: Awaited<ReturnType<InvokeHandler<C>>>;
        error?: undefined;
      }
    | { ok: false; error: string; data?: undefined }
  > => {
    try {
      const result = await handler(event, ...args);
      return { ok: true, data: result };
    } catch (error) {
      const message =
        (error as { message?: string }).message ||
        (error as { code?: string }).code ||
        String(error);

      return { ok: false, error: message };
    }
  };
  ipcMain.handle(channel, wrapped);
}
