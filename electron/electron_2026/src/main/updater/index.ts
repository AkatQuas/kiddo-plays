import { app } from 'electron'
import updater, {
  type UpdateCheckResult,
  type UpdateInfo,
} from 'electron-updater'
import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'
import { getWindowManager } from 'main/windows/manager'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  errorLogger,
  updaterLogger,
} from '../../lib/electron-app/factory/logger'

const { autoUpdater } = updater
/**
 * Electron Update Manager (Singleton + Lazy)
 * Handles auto updates, manual check, download, install
 */
export class Updater {
  private static instance: Updater
  #isUpdateAvailable = false
  #updateInfo: UpdateInfo | null = null

  // Private constructor (singleton)
  private constructor() {
    this.#configureUpdater()
    this.#setupEventListeners()
    this.#setupIpcHandler()
    updaterLogger.info('[Updater] Initialized update manager (singleton)')
  }

  /**
   * Lazy + Singleton instance
   */
  public static getInstance(): Updater {
    if (!Updater.instance) {
      Updater.instance = new Updater()
    }
    return Updater.instance
  }

  /**
   * Configure auto-updater
   */
  #configureUpdater(): void {
    autoUpdater.autoDownload = false // We control download
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    // Set feed URL (self-hosted)
    autoUpdater.setFeedURL({
      provider: 'generic', // or 'generic' for self-hosted
      url: 'https://your-server.com/updates/',
    })
  }

  /**
   * Listen to all updater events
   */
  #setupEventListeners(): void {
    // Update available
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      updaterLogger.info(`[Updater] Update available: ${info.version}`)
      this.#isUpdateAvailable = true
      this.#updateInfo = info
      getWindowManager().send('main', 'update-available', info)
    })

    // No update available
    autoUpdater.on('update-not-available', () => {
      updaterLogger.info('[Updater] No update available')
      getWindowManager().send('main', 'update-not-available')
    })

    // Download progress
    autoUpdater.on('download-progress', progress => {
      updaterLogger.debug(
        `[Updater] Download progress: ${progress.percent.toFixed(2)}%`
      )
      getWindowManager().send('main', 'download-progress', progress)
    })

    // Update downloaded
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      updaterLogger.info(`[Updater] Update downloaded: ${info.version}`)
      getWindowManager().send('main', 'update-downloaded', info)
    })

    // Error
    autoUpdater.on('error', err => {
      errorLogger.error('[Updater] Error', err)
      getWindowManager().send('main', 'update-error', err.message)
    })
  }

  #setupIpcHandler(): void {
    registerMainHandle('updater.check', () => this.checkForUpdates())
    registerMainHandle('updater.download', () => this.downloadUpdate())
    registerMainHandle('updater.install', () => this.installUpdate())
  }

  /**
   * Check if there's a downloaded update and install it silently
   * Called on app launch to install previous download
   */
  public async checkAndInstallDownloaded(): Promise<void> {
    updaterLogger.info('[Updater] Checking for downloaded updates...')

    // Check if there's a downloaded update file in the app userData path
    const userDataPath = app.getPath('userData')
    const updateInfoPath = path.join(userDataPath, 'update-info.json')

    // Check if update info file exists (created by electron-updater after download)
    try {
      await fs.access(updateInfoPath)
    } catch {
      updaterLogger.debug('[Updater] No downloaded update found')
      return
    }
    try {
      const updateInfoContent = await fs.readFile(updateInfoPath, 'utf-8')
      const updateInfo = JSON.parse(updateInfoContent) as UpdateInfo
      updaterLogger.info(
        '[Updater] Found downloaded update, installing silently...',
        updateInfo.version
      )
      // Install silently - will restart and install
      autoUpdater.quitAndInstall(false, true)
    } catch {
      updaterLogger.debug('[Updater] update info is broken, skipping')
    }
  }

  /**
   * Get current update info (if available)
   */
  public getUpdateInfo(): UpdateInfo | null {
    return this.#updateInfo
  }

  /**
   * Check for updates manually or automatically
   */
  public async checkForUpdates(): Promise<UpdateCheckResult | null> {
    try {
      updaterLogger.info('[Updater] Checking for updates...')
      const result = await autoUpdater.checkForUpdates()
      if (result?.updateInfo) {
        updaterLogger.info(
          `[Updater] Update check result: ${result.updateInfo.version} available`
        )
      } else {
        updaterLogger.info('[Updater] Update check result: no update available')
      }
      return result ?? null
    } catch (err) {
      errorLogger.error('[Updater] Check failed', err)
      return null
    }
  }

  /**
   * Start downloading update
   */
  public downloadUpdate(): void {
    if (!this.#isUpdateAvailable) {
      updaterLogger.warn('[Updater] No update to download')
      return
    }
    updaterLogger.info('[Updater] Starting update download...')
    autoUpdater.downloadUpdate().catch(err => {
      errorLogger.error('[Updater] Download failed', err)
    })
  }

  public installUpdate(): void {
    updaterLogger.info('[Updater] Installing update and restarting...')
    autoUpdater.quitAndInstall()
  }
}

export const getUpdater = () => {
  return Updater.getInstance()
}
