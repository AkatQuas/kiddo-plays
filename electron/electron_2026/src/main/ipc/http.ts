import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'
import type { HttpRequestOptions, HttpResponse } from 'shared/types/http'
import { settingsStore } from '../store'

/**
 * Base URL for API requests
 * Configure this in your environment or main process
 */
const BASE_URL = process.env.BASE_URL || '' // TODO: Set your API base URL here (e.g., 'https://api.example.com')

/**
 * Build full URL from options
 * If URL is relative, prepend BASE_URL
 */
function buildUrl(url?: string): string {
  if (!url) {
    return BASE_URL
  }

  // Check if URL is absolute (has protocol)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // Relative URL - prepend BASE_URL
  return BASE_URL
    ? `${BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    : url
}

/**
 * Apply proxy settings from store
 * Sets HTTP_PROXY or HTTPS_PROXY environment variables
 */
function applyProxy(url: string): void {
  const proxy = settingsStore.get('proxy', { enabled: false, url: '' })
  if (!proxy.enabled || !proxy.url) {
    return
  }

  const isHttps = url.startsWith('https://')
  if (isHttps) {
    process.env.HTTPS_PROXY = proxy.url
    process.env.https_proxy = proxy.url
  } else {
    process.env.HTTP_PROXY = proxy.url
    process.env.http_proxy = proxy.url
  }
}

/**
 * Clear proxy environment variables
 */
function clearProxy(): void {
  delete process.env.HTTP_PROXY
  delete process.env.HTTPS_PROXY
  delete process.env.http_proxy
  delete process.env.https_proxy
}

/**
 * Convert headers to plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

/**
 * Parse response body based on content-type
 */
async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  if (contentType.includes('text/')) {
    return response.text()
  }

  // Try JSON as fallback, otherwise return text
  try {
    return await response.json()
  } catch {
    return response.text()
  }
}

/**
 * Execute HTTP request in main process
 * This bypasses CORS restrictions that apply to renderer
 */
async function handleHttpRequest(
  _event: Electron.IpcMainInvokeEvent,
  options: HttpRequestOptions
): Promise<HttpResponse> {
  const url = buildUrl(options.url)

  if (!url) {
    throw new Error('No URL provided and no BASE_URL configured')
  }

  // Apply proxy if enabled
  applyProxy(url)

  try {
    // TODO: Replace with a wrapped fetch that includes tracing, logging, retries, etc.
    // Example: const response = await tracedFetch(url, options)
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    })

    const body = await parseBody(response)

    return {
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      body,
    }
  } finally {
    // Clear proxy after request
    clearProxy()
  }
}

/**
 * Register HTTP request handler
 */
export function registerHttpHandlers() {
  registerMainHandle('http.request', handleHttpRequest)
}
