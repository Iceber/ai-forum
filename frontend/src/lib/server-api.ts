import type { ApiResponse } from '@/types';

const FALLBACK_API_URL = process.env.API_DEFAULT_URL ?? 'http://localhost:3001';

// Environment variables are read at module load; base list is static for the runtime.
const API_BASES = Array.from(
  new Set(
    [
      process.env.API_INTERNAL_URL,
      process.env.NEXT_PUBLIC_API_URL,
      FALLBACK_API_URL,
    ].filter(Boolean),
  ),
);

/**
 * Server-side API fetch with base URL fallback.
 * @param path API path (recommended to start with '/api/...').
 * @returns Parsed ApiResponse on success.
 *          Returns null if all bases fail/return non-2xx or JSON parsing fails.
 *          JSON parse errors log a warning and continue to the next base URL.
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
        continue;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Server API fetch failed: ${base}${path}`, error);
      }
      continue;
    }
  }
  return null;
}
