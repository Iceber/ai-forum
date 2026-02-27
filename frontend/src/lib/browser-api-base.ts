const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '3001';
const API_BASE_FROM_ENV = process.env.NEXT_PUBLIC_API_URL;
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * API base resolution priority:
 * 1) NEXT_PUBLIC_API_URL
 * 2) window.location host/IP + NEXT_PUBLIC_API_PORT
 * 3) localhost + NEXT_PUBLIC_API_PORT (non-browser fallback)
 */
export function getBrowserApiBase(): string {
  if (typeof window !== 'undefined') {
    if (API_BASE_FROM_ENV) {
      try {
        const parsed = new URL(API_BASE_FROM_ENV);
        if (
          LOCALHOST_HOSTS.has(parsed.hostname) &&
          !LOCALHOST_HOSTS.has(window.location.hostname)
        ) {
          return `${window.location.protocol}//${window.location.hostname}:${parsed.port || API_PORT}`;
        }
        return API_BASE_FROM_ENV;
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Invalid NEXT_PUBLIC_API_URL, fallback to raw value.');
        }
        return API_BASE_FROM_ENV;
      }
    }
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  if (API_BASE_FROM_ENV) return API_BASE_FROM_ENV;
  return `http://localhost:${API_PORT}`;
}
