import * as cookie from 'cookie';
import { cookieStore } from '../stores/userStore';

type IData = { [k: string]: any };

export type RequestOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
};

const defaultOptions: RequestOptions = {
  baseUrl: '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
};

let globalOptions: RequestOptions = { ...defaultOptions };

/**
 * Get cookies from cookieStore for a specific domain and format as Cookie header string
 * @param domain The domain to get cookies for
 */
function getCookieHeader(domain: string): string {
  const cookies = cookieStore.get(domain, []);

  if (cookies.length === 0) {
    return '';
  }

  // Use cookie.serialize to format each cookie as name=value pairs
  return cookies
    .map((parsed) => {
      const [name, value] = Object.entries(parsed)[0];
      return cookie.stringifySetCookie({
        name,
        value,
      });
    })
    .join('; ');
}

/**
 * Save cookies from response Set-Cookie headers
 * @param response The fetch Response object
 * @param domain The domain to associate cookies with
 */
export async function saveCookiesFromResponse(response: Response, domain: string): Promise<void> {
  const setCookieHeader = response.headers.getSetCookie();
  if (setCookieHeader.length === 0) return;

  const parsedCookies = setCookieHeader.map((c) => cookie.parse(c));
  cookieStore.set(domain, parsedCookies);
}

export const request = {
  init(options: RequestOptions) {
    globalOptions = { ...defaultOptions, ...options };
  },

  async get<T = any>(url: string, query?: IData, options?: RequestOptions) {
    const opts = { ...globalOptions, ...options };
    const fullUrl = new URL(url, options?.baseUrl);

    // Add query params for GET
    if (query) {
      const params = fullUrl.searchParams;
      Object.entries(query).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        ...opts.headers,
        Cookie: getCookieHeader(fullUrl.hostname),
      },
      credentials: opts.withCredentials ? 'include' : 'same-origin',
    };

    if (opts.timeout && opts.timeout > 0) {
      const controller = new AbortController();
      fetchOptions.signal = controller.signal;
      setTimeout(() => controller.abort(), opts.timeout);
    }

    try {
      const response = await fetch(fullUrl, fetchOptions);
      await saveCookiesFromResponse(response, fullUrl.hostname);
      return handleResponse<T>(response);
    } catch (err: any) {
      throw createError(err);
    }
  },

  async post<T = any>(url: string, data?: IData, options?: RequestOptions) {
    const opts = { ...globalOptions, ...options };
    const fullUrl = new URL(url, options?.baseUrl);

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        ...opts.headers,
        Cookie: getCookieHeader(fullUrl.hostname),
      },
      credentials: opts.withCredentials ? 'include' : 'same-origin',
      body: data ? JSON.stringify(data) : undefined,
    };

    if (opts.timeout && opts.timeout > 0) {
      const controller = new AbortController();
      fetchOptions.signal = controller.signal;
      setTimeout(() => controller.abort(), opts.timeout);
    }

    try {
      const response = await fetch(fullUrl, fetchOptions);
      await saveCookiesFromResponse(response, fullUrl.hostname);
      return handleResponse<T>(response);
    } catch (err: any) {
      throw createError(err);
    }
  },
};

async function handleResponse<T>(response: Response): Promise<{
  success: boolean;
  msg: string;
  data: T;
}> {
  const contentType = response.headers.get('content-type');

  let data: any;
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
    try {
      data = JSON.parse(data);
    } catch {
      // Not JSON
    }
  }

  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || `Request failed: ${response.status}`);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data;
}

/**
 * create an error instance
 */
function createError(err: any): Error {
  if (err.name === 'AbortError') {
    const error = new Error('请求超时');
    (error as any).code = 'TIMEOUT';
    return error;
  }
  return err;
}
