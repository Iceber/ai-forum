import type { ApiResponse } from '@/types';

const API_BASES = Array.from(
  new Set(
    [
      process.env.API_INTERNAL_URL,
      process.env.NEXT_PUBLIC_API_URL,
      'http://localhost:3001',
    ].filter(Boolean),
  ),
);

export async function fetchApi<T>(path: string): Promise<ApiResponse<T> | null> {
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${path}`, { cache: 'no-store' });
      if (!res.ok) continue;
      return (await res.json()) as ApiResponse<T>;
    } catch {
      // try next base URL
    }
  }
  return null;
}
