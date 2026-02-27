const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '3001';
const API_BASE_FROM_ENV = process.env.NEXT_PUBLIC_API_URL;

export function getBrowserApiBase(): string {
  if (API_BASE_FROM_ENV) return API_BASE_FROM_ENV;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}
