import type { HttpRequestOptions, HttpResponse } from 'shared/types/http'

export interface HttpClientOptions extends Omit<HttpRequestOptions, 'url'> {
  /** Optional URL override - if not provided, uses baseUrl from settings */
  url?: string
}

/**
 * HTTP client that proxies requests through main process to bypass CORS
 *
 * @example
 * // GET request
 * const response = await httpClient.get('/api/users')
 *
 * // POST request with JSON body
 * const response = await httpClient.post('/api/users', {
 *   body: JSON.stringify({ name: 'John' }),
 *   headers: { 'Content-Type': 'application/json' }
 * })
 *
 * // Absolute URL (bypasses baseUrl)
 * const response = await httpClient.get('https://api.example.com/users')
 */
export const httpClient = {
  /**
   * GET request
   */
  async get(
    url: string,
    options?: Omit<HttpClientOptions, 'method' | 'url'>
  ): Promise<HttpResponse> {
    return httpClient.request({ ...options, url, method: 'GET' })
  },

  /**
   * POST request
   */
  async post(
    url: string,
    options?: Omit<HttpClientOptions, 'method' | 'url'>
  ): Promise<HttpResponse> {
    return httpClient.request({ ...options, url, method: 'POST' })
  },

  /**
   * PUT request
   */
  async put(
    url: string,
    options?: Omit<HttpClientOptions, 'method' | 'url'>
  ): Promise<HttpResponse> {
    return httpClient.request({ ...options, url, method: 'PUT' })
  },

  /**
   * DELETE request
   */
  async delete(
    url: string,
    options?: Omit<HttpClientOptions, 'method' | 'url'>
  ): Promise<HttpResponse> {
    return httpClient.request({ ...options, url, method: 'DELETE' })
  },

  /**
   * PATCH request
   */
  async patch(
    url: string,
    options?: Omit<HttpClientOptions, 'method' | 'url'>
  ): Promise<HttpResponse> {
    return httpClient.request({ ...options, url, method: 'PATCH' })
  },

  /**
   * Generic request method
   */
  async request(options: HttpClientOptions): Promise<HttpResponse> {
    const result = await window.App.invoke('http.request', options)
    if (!result.ok) {
      throw new Error(result.error)
    }
    return result.data
  },
}
