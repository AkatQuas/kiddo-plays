/**
 * Application Menu Configuration
 * Singleton class for managing the native application menu
 */
import { BrowserWindow, Menu, app, dialog, shell } from 'electron'
import { t } from 'i18next'
import { getWindowManager } from 'main/windows/manager'
import { PLATFORM } from 'shared/constants'
import { AppRoutes } from 'shared/constants/routes'

class MenuManager {
  private static instance: MenuManager | null = null
  private menu: Electron.Menu | null = null

  private constructor() {}

  static getInstance(): MenuManager {
    if (!MenuManager.instance) {
      MenuManager.instance = new MenuManager()
    }
    return MenuManager.instance
  }

  update(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      // App menu (macOS only)
      ...(PLATFORM.IS_MAC
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                {
                  label: 'Preferences...',
                  accelerator: 'Cmd+,',
                  click: () => {
                    getWindowManager().send(
                      'main',
                      'navigate',
                      AppRoutes.main.SETTINGS
                    )
                  },
                },
                { type: 'separator' as const },
                { role: 'services' as const },
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const },
              ],
            },
          ]
        : []),

      // File menu
      {
        label: 'File',
        submenu: [
          {
            label: 'New Chat',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              win?.webContents.send('navigate', AppRoutes.main.HOME)
            },
          },
          { type: 'separator' },
          PLATFORM.IS_MAC ? { role: 'close' } : { role: 'quit' },
        ],
      },

      // Edit menu
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(PLATFORM.IS_MAC
            ? [
                { role: 'pasteAndMatchStyle' as const },
                { role: 'delete' as const },
                { role: 'selectAll' as const },
              ]
            : [
                { role: 'delete' as const },
                { type: 'separator' as const },
                { role: 'selectAll' as const },
              ]),
        ],
      },

      // View menu
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },

      // Navigate menu
      {
        label: 'Navigate',
        submenu: [
          {
            label: 'Dashboard',
            accelerator: 'CmdOrCtrl+1',
            click: () => {},
          },
          {
            label: 'Chat',
            accelerator: 'CmdOrCtrl+2',
            click: () => {},
          },
          {
            label: 'Channels',
            accelerator: 'CmdOrCtrl+3',
            click: () => {},
          },
          {
            label: 'Skills',
            accelerator: 'CmdOrCtrl+4',
            click: () => {},
          },
          {
            label: 'Cron Tasks',
            accelerator: 'CmdOrCtrl+5',
            click: () => {},
          },
        ],
      },

      // Window menu
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(PLATFORM.IS_MAC
            ? [
                { type: 'separator' as const },
                { role: 'front' as const },
                { type: 'separator' as const },
                { role: 'window' as const },
              ]
            : [{ role: 'close' as const }]),
        ],
      },

      // Help menu
      {
        role: 'help',
        submenu: [
          {
            label: t('hello'),
          },
          {
            label: 'Documentation',
            click: async () => {
              await shell.openExternal('')
            },
          },
          {
            label: 'Report Issue',
            click: async () => {
              const win = getWindowManager().get('main')
              if (win) {
                await dialog.showMessageBox(win, {
                  type: 'info',
                  title: 'Coming Soon',
                  message: 'This feature is under development.',
                  buttons: ['OK'],
                })
              }
            },
          },
          { type: 'separator' },
          {
            label: 'OpenClaw Documentation',
            click: async () => {
              await shell.openExternal('')
            },
          },
        ],
      },
    ]

    this.menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(this.menu)
  }
}

export const getMenuManager = () => MenuManager.getInstance()
