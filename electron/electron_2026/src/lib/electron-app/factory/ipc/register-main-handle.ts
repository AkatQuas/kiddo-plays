import { ipcMain } from 'electron'
import type { InvokeArgs, InvokeChannel, InvokeHandler } from 'shared/types/ipc'

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Create a success response
 */
export function ipcSuccess<T>(data: T): { ok: true; data: T } {
  return { ok: true, data }
}

/**
 * Create an error response
 */
export function ipcError<E = string>(error: E): { ok: false; error: E } {
  return { ok: false, error }
}

/**
 * Register a typed IPC handler in main process
 * Automatically catches errors and returns { ok: false, error } on failure
 *
 * @param channel - IPC channel name
 * @param handler - Handler function
 *
 * @example
 * // On success: returns your data
 * // On error: throws or returns { ok: false, error }
 * registerMainHandle('auth.login', async () => {
 *   const user = await authenticate()
 *   return { ok: true, data: { token: user.jwt } }
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
        ok: boolean
        data: Awaited<ReturnType<InvokeHandler<C>>>
        error?: undefined
      }
    | { ok: boolean; error: string; data?: undefined }
  > => {
    try {
      const result = await handler(event, ...args)
      return { ok: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: message }
    }
  }
  ipcMain.handle(channel, wrapped)
}
