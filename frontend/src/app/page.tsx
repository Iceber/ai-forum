import type { Post, Bar, ApiResponse, PageMeta } from '@/types';
import HomeClient from './HomeClient';

const API_BASES = Array.from(
  new Set(
    [
      process.env.API_INTERNAL_URL,
      process.env.NEXT_PUBLIC_API_URL,
      'http://localhost:3001',
    ].filter(Boolean),
  ),
);

async function fetchApi<T>(path: string): Promise<ApiResponse<T> | null> {
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

async function fetchInitialPosts(): Promise<{ posts: Post[]; meta: PageMeta }> {
  try {
    const json = await fetchApi<Post[]>('/api/posts?limit=20');
    if (!json) throw new Error('Failed to load posts');
    if (json.error) throw new Error(json.error.message);
    return {
      posts: json.data ?? [],
      meta: json.meta ?? { hasMore: false },
    };
  } catch {
    return { posts: [], meta: { hasMore: false } };
  }
}

async function fetchInitialBars(): Promise<Bar[]> {
  try {
    const json = await fetchApi<Bar[]>('/api/bars?limit=12');
    if (!json) throw new Error('Failed to load bars');
    if (json.error) throw new Error(json.error.message);
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [{ posts, meta }, bars] = await Promise.all([
    fetchInitialPosts(),
    fetchInitialBars(),
  ]);
  return <HomeClient initialPosts={posts} initialMeta={meta} initialBars={bars} />;
}
