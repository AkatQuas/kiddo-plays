import { BrowserWindow } from 'electron'
import type { EventArgs, EventChannel } from 'shared/types/ipc'
import type { WindowType } from 'shared/types/window'
import type { CreatedBrowserWindow } from './create'

/**
 * Fixed main window identifier
 * Main window is always required and is the initial window
 */
export const MAIN_WINDOW: WindowType = 'main'

/**
 * Extended window factory type
 * Used for optional windows registered via register()
 */
export type WindowFactory = () => Promise<CreatedBrowserWindow>

/**
 * Centralized window management for the main process.
 * Provides create, display control, and IPC communication for all app windows.
 *
 * Main window is required in constructor, additional windows can be registered via register().
 *
 * @example
 * // Create with main window (required)
 * const manager = new WindowManager({
 *   main: async () => MainWindow(),
 * })
 *
 * // Register additional windows (typed as WindowType)
 * manager.register('settings', async () => SettingsWindow())
 * manager.register('chat', async () => ChatWindow())
 *
 * // Use the windows
 * manager.show('main')
 * manager.get('settings')
 * manager.close('chat')
 */
export class WindowManager {
  protected windows = new Map<WindowType, CreatedBrowserWindow>()
  #factories = new Map<WindowType, WindowFactory>()

  /**
   * @param mainWindow - Required main window factory
   */
  constructor(mainFactory: WindowFactory) {
    this.#factories.set(MAIN_WINDOW, mainFactory)
  }

  /**
   * Register a new window type with its factory
   * Allows adding types dynamically at runtime
   *
   * @param type - Window identifier (must be WindowType from electron-router-dom)
   * @param factory - Factory function to create the window
   *
   * @example
   * manager.register('settings', async () => SettingsWindow())
   */
  register(type: WindowType, factory: WindowFactory): void {
    // Guard: Cannot register main window (already set in constructor)
    if (type === MAIN_WINDOW) {
      throw new Error(
        `Cannot register '${MAIN_WINDOW}' window - it is reserved and already registered in the constructor`
      )
    }

    // Guard: Cannot register the same factory twice
    if (this.#factories.has(type)) {
      throw new Error(`Factory for window type '${type}' is already registered`)
    }

    this.#factories.set(type, factory)
  }

  set(type: WindowType, window: CreatedBrowserWindow): void {
    this.windows.set(type, window)
  }

  get(type: WindowType): CreatedBrowserWindow | null {
    return this.windows.get(type) ?? null
  }

  getAll(): Map<WindowType, CreatedBrowserWindow> {
    return this.windows
  }

  has(type: WindowType): boolean {
    return this.windows.has(type)
  }

  show(type: WindowType): void {
    const window = this.windows.get(type)
    if (window) {
      window.show()
      window.focus()
    }
  }

  hide(type: WindowType): void {
    const window = this.windows.get(type)
    if (window) {
      window.hide()
    }
  }

  close(type: WindowType): void {
    const window = this.windows.get(type)
    if (window) {
      window.close()
      this.windows.delete(type)
    }
  }

  send<C extends EventChannel>(
    type: WindowType,
    channel: C,
    ...args: EventArgs<C>
  ): void {
    const window = this.windows.get(type)
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, ...args)
    }
  }

  broadcast<C extends EventChannel>(channel: C, ...args: EventArgs<C>): void {
    for (const [, window] of this.windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, ...args)
      }
    }
  }

  /**
   * Get existing window or create new one using registered factory
   */
  async getOrCreate(type: WindowType): Promise<CreatedBrowserWindow> {
    const existing = this.windows.get(type)
    if (existing) {
      return existing
    }

    const factory = this.#factories.get(type)
    if (!factory) {
      throw new Error(`No factory registered for window type: ${type}`)
    }

    const window = await factory()
    this.set(type, window)
    return window
  }

  /**
   * Close existing window if any, then create new one using registered factory
   */
  async create(type: WindowType): Promise<CreatedBrowserWindow> {
    if (this.windows.has(type)) {
      const existing = this.windows.get(type)
      if (existing && !existing.isDestroyed()) {
        existing.close()
      }
      this.windows.delete(type)
    }

    const factory = this.#factories.get(type)
    if (!factory) {
      throw new Error(`No factory registered for window type: ${type}`)
    }

    const window = await factory()
    this.set(type, window)
    return window
  }

  /**
   * Restore the most recent window if any exists, otherwise create main window
   */
  async restoreOrCreate(): Promise<CreatedBrowserWindow> {
    const allWindows = BrowserWindow.getAllWindows()

    if (allWindows.length > 0) {
      const lastWindow = allWindows[allWindows.length - 1]
      allWindows.forEach(a => void a.restore())
      lastWindow.focus()
      return lastWindow as CreatedBrowserWindow
    }

    return this.createMainWindow()
  }

  /**
   * Create the initial main window
   * Main window is always required and is created first
   */
  async createMainWindow(): Promise<CreatedBrowserWindow> {
    const factory = this.#factories.get(MAIN_WINDOW)
    if (!factory) {
      throw new Error(`Main window factory is required but not registered`)
    }
    const window = await factory()
    this.set(MAIN_WINDOW, window)
    return window
  }
}
