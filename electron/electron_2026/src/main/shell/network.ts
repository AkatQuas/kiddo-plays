import { net } from 'electron'
import { mainLogger } from 'lib/electron-app/factory/logger'
import { getWindowManager } from '../windows/manager'

const CHECK_INTERVAL = 30000 // 5 seconds
// Health check URL - can be overridden via environment variable
const HEALTH_CHECK_URL =
  process.env.HEALTH_CHECK_URL || 'http://localhost:3000/api/health'
const HEALTH_CHECK_TIMEOUT = 5000 // 5 seconds

export interface NetworkStatus {
  isOnline: boolean
  isServiceReachable: boolean
}

/**
 * Network Monitor (Singleton + Lazy)
 * Monitors network connectivity and service reachability
 */
export class NetworkMonitor {
  private static instance: NetworkMonitor
  #checkInterval: NodeJS.Timeout | null = null
  #lastKnownStatus: NetworkStatus = {
    isOnline: false,
    isServiceReachable: false,
  }

  // Private constructor (singleton)
  private constructor() {
    mainLogger.info('[Network] Initialized network monitor (singleton)')
  }

  /**
   * Lazy + Singleton instance
   */
  public static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor()
    }
    return NetworkMonitor.instance
  }

  /**
   * Check if network is available using Electron's net module
   */
  #checkNetworkConnectivity(): boolean {
    return net.isOnline()
  }

  /**
   * Check if the service is reachable by making an HTTP request to health endpoint
   */
  async #checkServiceReachability(): Promise<boolean> {
    return new Promise(resolve => {
      const req = net.request({
        method: 'GET',
        url: HEALTH_CHECK_URL,
      })

      let timedOut = false

      const timeoutId = setTimeout(() => {
        timedOut = true
        req.abort()
        resolve(false)
      }, HEALTH_CHECK_TIMEOUT)

      req.on('response', response => {
        clearTimeout(timeoutId)
        // Consider it reachable if we get any response (2xx, 4xx, 5xx)
        // The service is "reachable" even if it returns an error
        resolve(!timedOut && response.statusCode > 0)
      })

      req.on('error', () => {
        clearTimeout(timeoutId)
        resolve(false)
      })

      req.end()
    })
  }

  /**
   * Check network status - both connectivity and service reachability
   */
  async #checkNetworkStatus(): Promise<NetworkStatus> {
    const isOnline = this.#checkNetworkConnectivity()

    // Only check service if network is online
    const isServiceReachable = isOnline
      ? await this.#checkServiceReachability()
      : false

    return { isOnline, isServiceReachable }
  }

  /**
   * Broadcast network status to all renderer windows
   */
  #broadcastNetworkStatus(status: NetworkStatus): void {
    const windowManager = getWindowManager()
    windowManager.broadcast('network.status', status)
    mainLogger.info(
      `[Network] Status: Online=${status.isOnline}, ServiceReachable=${status.isServiceReachable}`
    )
  }

  /**
   * Periodic network status check
   */
  async #checkAndBroadcast(): Promise<void> {
    const status = await this.#checkNetworkStatus()

    // Only broadcast when either status changes
    if (
      status.isOnline !== this.#lastKnownStatus.isOnline ||
      status.isServiceReachable !== this.#lastKnownStatus.isServiceReachable
    ) {
      this.#lastKnownStatus = status
    }
    this.#broadcastNetworkStatus(this.#lastKnownStatus)
  }

  /**
   * Start network monitoring
   * Polls network status periodically and broadcasts changes to renderers
   */
  public start(): void {
    // Set up periodic check
    this.#checkInterval = setInterval(
      () => this.#checkAndBroadcast(),
      CHECK_INTERVAL
    )

    mainLogger.info('[Network] Monitor started')
  }

  /**
   * Stop network monitoring
   */
  public stop(): void {
    if (this.#checkInterval) {
      clearInterval(this.#checkInterval)
      this.#checkInterval = null
      mainLogger.info('[Network] Monitor stopped')
    }
  }

  /**
   * Get current network status
   */
  public getStatus(): NetworkStatus {
    return this.#lastKnownStatus
  }
}

export const getNetworkMonitor = () => {
  return NetworkMonitor.getInstance()
}
