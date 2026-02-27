const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '3001';
const API_BASE_FROM_ENV = process.env.NEXT_PUBLIC_API_URL;

/**
 * API base resolution priority:
 * 1) NEXT_PUBLIC_API_URL
 * 2) window.location host/IP + NEXT_PUBLIC_API_PORT
 * 3) localhost + NEXT_PUBLIC_API_PORT (non-browser fallback)
 */
export function getBrowserApiBase(): string {
  if (API_BASE_FROM_ENV) return API_BASE_FROM_ENV;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}
