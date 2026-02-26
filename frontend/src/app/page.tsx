import type { Post, Bar, ApiResponse, PageMeta } from '@/types';
import HomeClient from './HomeClient';

const API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

async function fetchInitialPosts(): Promise<{ posts: Post[]; meta: PageMeta }> {
  try {
    const res = await fetch(`${API_URL}/api/posts?limit=20`, {
      cache: 'no-store',
    });
    const json: ApiResponse<Post[]> = await res.json();
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
    const res = await fetch(`${API_URL}/api/bars?limit=12`, {
      cache: 'no-store',
    });
    const json: ApiResponse<Bar[]> = await res.json();
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
