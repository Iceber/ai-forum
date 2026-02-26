import type { ApiResponse } from '@/types';

const DEFAULT_API_URL = 'http://localhost:3001';

const API_BASES = Array.from(
  new Set(
    [
      process.env.API_INTERNAL_URL,
      process.env.NEXT_PUBLIC_API_URL,
      DEFAULT_API_URL,
    ].filter(Boolean),
  ),
);

/**
 * Server-side API fetch with base URL fallback.
 * @param path API path starting with '/api/...'
 * @returns Parsed ApiResponse or null if all bases fail or respond non-2xx.
 */
export async function fetchApi<T>(path: string): Promise<ApiResponse<T> | null> {
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${path}`, { cache: 'no-store' });
      if (!res.ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `Server API fetch returned ${res.status} for ${base}${path}`,
          );
        }
        continue;
      }
      try {
        return (await res.json()) as ApiResponse<T>;
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Server API JSON parse failed: ${base}${path}`, error);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Server API fetch failed: ${base}${path}`, error);
      }
    }
  }
  return null;
}
