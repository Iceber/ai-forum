'use client';

import { useState, useEffect } from 'react';
import type { Post, Bar, PageMeta, ApiResponse } from '@/types';
import PostCard from '@/components/post/PostCard';
import BarCard from '@/components/bar/BarCard';
import apiClient from '@/lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface HomeClientProps {
  initialPosts: Post[];
  initialMeta: PageMeta;
  initialBars: Bar[];
}

export default function HomeClient({
  initialPosts,
  initialMeta,
  initialBars,
}: HomeClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [meta, setMeta] = useState<PageMeta>(initialMeta);
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [loading, setLoading] = useState(false);

  // Client-side fallback: fetch data if SSR returned empty
  useEffect(() => {
    async function fetchFallback() {
      if (posts.length === 0) {
        try {
          const res = await fetch(`${API_BASE}/api/posts?limit=20`);
          if (res.ok) {
            const json: ApiResponse<Post[]> = await res.json();
            if (json.data && json.data.length > 0) {
              setPosts(json.data);
              setMeta(json.meta ?? { hasMore: false });
            }
          }
        } catch { /* ignore */ }
      }
      if (bars.length === 0) {
        try {
          const res = await fetch(`${API_BASE}/api/bars?limit=12`);
          if (res.ok) {
            const json: ApiResponse<Bar[]> = await res.json();
            if (json.data && json.data.length > 0) {
              setBars(json.data);
            }
          }
        } catch { /* ignore */ }
      }
    }
    fetchFallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!meta.hasMore || loading) return;
    setLoading(true);
    try {
      const rawRes = await fetch(
        `${API_BASE}/api/posts?cursor=${meta.cursor ?? ''}&limit=20`,
      );
      const json: ApiResponse<Post[]> = await rawRes.json();
      if (json.data) {
        setPosts((prev) => [...prev, ...json.data!]);
        setMeta(json.meta ?? { hasMore: false });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">推荐吧</h2>
        </div>
        {initialBars.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无吧</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {initialBars.map((bar) => (
              <BarCard
                key={bar.id}
                id={bar.id}
                name={bar.name}
                description={bar.description ?? ''}
              />
            ))}
          </div>
        )}
      </section>

      <h1 className="text-2xl font-bold mb-6 text-gray-900">最新帖子</h1>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无帖子</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              title={post.title}
              content={post.content}
              authorNickname={post.author?.nickname ?? '匿名'}
              barName={post.bar?.name ?? '未知板块'}
              barId={post.barId}
              replyCount={post.replyCount}
              createdAt={post.createdAt}
            />
          ))}
        </div>
      )}

      {meta.hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
}
