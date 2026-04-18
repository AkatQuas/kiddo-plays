import path from 'node:path';
import type { InvokeArgs } from '@shared/types/ipc';
import { BrowserWindow, type BrowserWindowConstructorOptions, screen } from 'electron';

// ============================================================================
// Window Configuration
// ============================================================================

export interface WindowConfig extends Partial<BrowserWindowConstructorOptions> {
  /** Unique identifier for the window */
  id: string;
  /** Route path to load (for SPA) */
  route?: string;
  /** Whether to show immediately or wait for ready-to-show */
  showImmediately?: boolean;
  /** Center window on screen (default: true) */
  center?: boolean;
}

// Default preload path
const getPreloadPath = () => path.join(__dirname, 'preload.js');

// ============================================================================
// Window Configurations
// ============================================================================

export const WINDOW_CONFIGS = {
  login: {
    id: 'login',
    width: 400,
    height: 555,
    resizable: false,
    route: '/login',
  },
  main: {
    id: 'main',
    width: 1280,
    height: 800,
    route: '/',
    showImmediately: true,
  },
} as const;

// Type helper to get window IDs
export type WindowId = keyof typeof WINDOW_CONFIGS;

// ============================================================================
// Window Manager
// ============================================================================

class WindowManager {
  private windows = new Map<WindowId, BrowserWindow>();

  /**
   * Get a window by ID
   */
  get(id: WindowId): BrowserWindow | undefined {
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      return win;
    }
    // Clean up destroyed window reference
    this.windows.delete(id);
    return undefined;
  }

  /**
   * Get all active windows
   */
  getAll(): Map<WindowId, BrowserWindow> {
    // Clean up destroyed windows
    for (const [id, win] of this.windows) {
      if (win.isDestroyed()) {
        this.windows.delete(id);
      }
    }
    return new Map(this.windows);
  }

  /**
   * Check if a window exists and is not destroyed
   */
  has(id: WindowId): boolean {
    return this.get(id) !== undefined;
  }

  /**
   * Create a window by config ID
   */
  create(id: WindowId): BrowserWindow {
    // Return existing window if it exists
    const existing = this.get(id);
    if (existing) {
      existing.focus();
      return existing;
    }

    const config = WINDOW_CONFIGS[id];
    if (!config) {
      throw new Error(`Window config not found: ${id}`);
    }

    const window = this.createFromConfig(config);
    this.windows.set(id, window);
    return window;
  }

  /**
   * Create a window from config
   */
  private createFromConfig(config: WindowConfig): BrowserWindow {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Build window options - merge config with defaults
    const windowOptions: BrowserWindowConstructorOptions = {
      width: config.width ?? 800,
      height: config.height ?? 600,
      resizable: config.resizable ?? true,
      frame: config.frame ?? false,
      transparent: config.transparent ?? false,
      backgroundColor: config.backgroundColor ?? '#ffffff',
      show: config.showImmediately ?? false,
      webPreferences: {
        ...config.webPreferences,
        preload: config.webPreferences?.preload ?? getPreloadPath(),
        contextIsolation: config.webPreferences?.contextIsolation ?? true,
        nodeIntegration: config.webPreferences?.nodeIntegration ?? false,
        sandbox: config.webPreferences?.sandbox ?? false,
      },
      ...config,
    };

    // Center window unless explicitly disabled or position is set
    const shouldCenter = config.center !== false && !config.x && !config.y;
    if (shouldCenter && windowOptions.width && windowOptions.height) {
      windowOptions.x = Math.floor((screenWidth - windowOptions.width) / 2);
      windowOptions.y = Math.floor((screenHeight - windowOptions.height) / 2);
    }

    const window = new BrowserWindow(windowOptions);

    // Load the route
    if (config.route) {
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#${config.route}`);
      } else {
        window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
          hash: config.route,
        });
      }
    }

    // Show when ready (if not showing immediately)
    if (!config.showImmediately) {
      window.once('ready-to-show', () => {
        window.show();
      });
    }

    // Clean up reference when closed
    window.on('closed', () => {
      this.windows.delete(config.id as WindowId);
    });

    return window;
  }

  /**
   * Show a window by ID (create if doesn't exist)
   */
  show(id: WindowId): BrowserWindow {
    const existing = this.get(id);
    if (existing) {
      existing.show();
      existing.focus();
      return existing;
    }
    return this.create(id);
  }

  /**
   * Hide a window by ID
   */
  hide(id: WindowId): void {
    const window = this.get(id);
    if (window) {
      window.hide();
    }
  }

  /**
   * Close a window by ID
   */
  close(id: WindowId): void {
    const window = this.get(id);
    if (window) {
      window.close();
    }
  }

  /**
   * Focus a window by ID
   */
  focus(id: WindowId): void {
    const window = this.get(id);
    if (window) {
      window.focus();
    }
  }

  /**
   * Minimize a window (or focused window)
   */
  minimize(id?: WindowId): void {
    const window = id ? this.get(id) : BrowserWindow.getFocusedWindow();
    if (window) {
      window.minimize();
    }
  }

  /**
   * Maximize or restore a window (or focused window)
   */
  toggleMaximize(id?: WindowId): void {
    const window = id ? this.get(id) : BrowserWindow.getFocusedWindow();
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  }

  /**
   * Check if a window is maximized
   */
  isMaximized(id?: WindowId): boolean {
    const window = id ? this.get(id) : BrowserWindow.getFocusedWindow();
    return window?.isMaximized() ?? false;
  }

  /**
   * Close all windows
   */
  closeAll(): void {
    for (const [, window] of this.windows) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.windows.clear();
  }

  windowForExternal(options: InvokeArgs<'window.open_external'>[0]) {
    const { url, title = '', height = 800, width = 1280 } = options;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('url is wrong');
    }
    const newWindow = new BrowserWindow({
      width,
      height,
      resizable: false,
      frame: true,
      title,
    });

    newWindow.loadURL(url);
  }
}

// Singleton instance
export const windowManager = new WindowManager();
