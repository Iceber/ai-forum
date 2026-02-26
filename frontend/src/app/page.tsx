import type { Post, Bar, PageMeta } from '@/types';
import HomeClient from './HomeClient';
import { fetchApi } from '@/lib/server-api';

async function fetchInitialPosts(): Promise<{ posts: Post[]; meta: PageMeta }> {
  try {
    const json = await fetchApi<Post[]>('/api/posts?limit=20');
    if (!json) throw new Error('Failed to fetch posts from API');
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
    if (!json) throw new Error('Failed to fetch bars from API');
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
