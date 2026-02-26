import type { ApiResponse } from '@/types';

const API_DEFAULT_URL = process.env.API_DEFAULT_URL ?? 'http://localhost:3001';

// Priority order: API_INTERNAL_URL (Docker) → NEXT_PUBLIC_API_URL (browser) → API_DEFAULT_URL (fallback).
// Environment variables are read at module load; base list is static for the runtime.
const API_BASES_RAW = [
  process.env.API_INTERNAL_URL,
  process.env.NEXT_PUBLIC_API_URL,
  API_DEFAULT_URL,
].filter(Boolean);
const API_BASES = Array.from(new Set(API_BASES_RAW));

if (
  process.env.NODE_ENV !== 'production' &&
  API_BASES.length < API_BASES_RAW.length
) {
  console.warn('Duplicate API base URLs detected; fallback list was deduplicated.');
}

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
