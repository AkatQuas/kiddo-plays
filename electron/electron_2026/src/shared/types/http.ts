// ============================================================================
// HTTP Types
// ============================================================================

/**
 * HTTP request options for proxy
 */
export interface HttpRequestOptions {
  /** Request path - if relative, prepends BASE_URL */
  url?: string
  /** HTTP method, default to be 'GET' */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  /** Request headers */
  headers?: Record<string, string>
  /** Request body (string or JSON) */
  body?: string
}

/**
 * HTTP response from proxy
 */
export interface HttpResponse {
  /** HTTP status code */
  status: number
  /** HTTP status text */
  statusText: string
  /** Response headers */
  headers: Record<string, string>
  /** Response body */
  body: unknown
}
