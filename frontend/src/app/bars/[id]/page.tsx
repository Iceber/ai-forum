import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Bar, Post, ApiResponse, PageMeta } from '@/types';
import PostCard from '@/components/post/PostCard';
import BarPostsClient from './BarPostsClient';

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

async function fetchBar(id: string): Promise<Bar | null> {
  try {
    const json = await fetchApi<Bar>(`/api/bars/${id}`);
    if (!json) return null;
    return json.error ? null : (json.data ?? null);
  } catch {
    return null;
  }
}

async function fetchBarPosts(
  barId: string,
): Promise<{ posts: Post[]; meta: PageMeta }> {
  try {
    const json = await fetchApi<Post[]>(`/api/posts?barId=${barId}&limit=20`);
    if (!json) return { posts: [], meta: { hasMore: false } };
    return {
      posts: json.data ?? [],
      meta: json.meta ?? { hasMore: false },
    };
  } catch {
    return { posts: [], meta: { hasMore: false } };
  }
}

export default async function BarPage({
  params,
}: {
  params: { id: string };
}) {
  const [bar, { posts, meta }] = await Promise.all([
    fetchBar(params.id),
    fetchBarPosts(params.id),
  ]);

  if (!bar) return notFound();

  return (
    <div>
      {/* Bar info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{bar.name}</h1>
            {bar.description && (
              <p className="mt-1 text-gray-500 text-sm">{bar.description}</p>
            )}
          </div>
          <Link
            href={`/create-post?barId=${bar.id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors shrink-0 ml-4"
          >
            在此发帖
          </Link>
        </div>
      </div>

      <BarPostsClient initialPosts={posts} initialMeta={meta} barId={bar.id} />
    </div>
  );
}
