export interface FetchOptions extends RequestInit {
  timeout?: number;
}

export const fetchWithTimeout = async (
  url: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const handleFetchError = (error: any): string => {
  if (error.name === 'AbortError') {
    return 'Request timed out. Please try again.';
  }
  if (error.message.includes('Failed to fetch')) {
    return 'Network error. Please check your internet connection.';
  }
  return error.message || 'An unknown error occurred';
};
