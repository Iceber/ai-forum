import type { Post, ApiResponse, PageMeta } from '@/types';
import HomeClient from './HomeClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

export default async function HomePage() {
  const { posts, meta } = await fetchInitialPosts();
  return <HomeClient initialPosts={posts} initialMeta={meta} />;
}
