/**
 * System Tray Management
 * Singleton class for managing the system tray icon and menu
 */
import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { displayName } from '~/package.json'

export class TrayManager {
  private static instance: TrayManager | null = null
  #tray: Tray | null = null

  private constructor() {
    this.#create()
  }

  static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager()
    }
    return TrayManager.instance
  }

  /**
   * Resolve the icons directory path (works in both dev and packaged mode)
   */
  #getIconsDir(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'resources', 'icons')
    }
    return join(__dirname, '../../../src/resources/build/icons')
  }

  /**
   * Get platform-appropriate icon for system tray
   */
  #getIcon(): Electron.NativeImage {
    const iconsDir = this.#getIconsDir()
    let iconPath: string

    if (process.platform === 'win32') {
      iconPath = join(iconsDir, 'icon.ico')
    } else if (process.platform === 'darwin') {
      iconPath = join(iconsDir, 'tray-icon-Template.png')
    } else {
      iconPath = join(iconsDir, '32x32.png')
    }

    let icon = nativeImage.createFromPath(iconPath)

    if (icon.isEmpty()) {
      icon = nativeImage.createFromPath(join(iconsDir, 'icon.png'))
      if (process.platform === 'darwin') {
        icon.setTemplateImage(true)
      }
    }

    if (process.platform === 'darwin') {
      icon.setTemplateImage(true)
    }
    return icon
  }

  /**
   * Build and set the tray context menu
   */
  update(): void {
    if (!this.#tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Show ${displayName}`,
        click: () => {
          // windowManager
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Gateway Status',
        enabled: false,
      },
      {
        label: '  Running',
        type: 'checkbox',
        checked: true,
        enabled: false,
      },
      {
        type: 'separator',
      },
      {
        label: 'Check for Updates...',
        click: () => {
          // updater handler
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        },
      },
    ])

    this.#tray.setContextMenu(contextMenu)
  }

  /**
   * Update tray tooltip with Gateway status
   */
  updateStatus(status: string): void {
    if (this.#tray) {
      this.#tray.setToolTip(`${displayName} - ${status}`)
    }
  }

  /**
   * Create system tray icon and menu
   */
  #create(): TrayManager {
    this.#tray = new Tray(this.#getIcon())
    this.#tray.setToolTip(displayName)
    this.update()

    if (process.platform !== 'darwin') {
      this.#tray.on('click', () => {
        // window manager handler
      })

      this.#tray.on('double-click', () => {
        // widow manager handler
      })
    }
    return this
  }

  destroy(): void {
    if (this.#tray) {
      this.#tray.destroy()
      this.#tray = null
    }
  }
}

export const getTrayManager = () => TrayManager.getInstance()
