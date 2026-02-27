'use client';

import { useState, useEffect, useRef } from 'react';
import type { Post, Bar, MyBar, PageMeta, ApiResponse } from '@/types';
import Link from 'next/link';
import PostCard from '@/components/post/PostCard';
import BarStatusBadge from '@/components/bar/BarStatusBadge';
import useAuthStore from '@/lib/auth';
import { getBrowserApiBase } from '@/lib/browser-api-base';

const API_BASE = getBrowserApiBase();

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
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [meta, setMeta] = useState<PageMeta>(initialMeta);
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [myBars, setMyBars] = useState<MyBar[]>([]);
  const [loading, setLoading] = useState(false);
  const didFetchFallback = useRef(false);

  // Client-side fallback: fetch data if SSR returned empty (runs once)
  useEffect(() => {
    if (didFetchFallback.current) return;
    didFetchFallback.current = true;

    async function fetchFallback() {
      if (initialPosts.length === 0) {
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
      if (initialBars.length === 0) {
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
  }, [initialPosts.length, initialBars.length]);

  // Fetch "My Bars" when user is logged in
  useEffect(() => {
    if (!user) {
      setMyBars([]);
      return;
    }
    async function fetchMyBars() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/users/me/bars?limit=20`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json: ApiResponse<MyBar[]> = await res.json();
          if (json.data) setMyBars(json.data);
        }
      } catch { /* ignore */ }
    }
    fetchMyBars();
  }, [user]);

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
      {/* My Bars section - shown when logged in */}
      {user && myBars.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">我的吧</h2>
          <div className="flex flex-wrap gap-2">
            {myBars.map((bar) => (
              <Link
                key={bar.id}
                href={`/bars/${bar.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                {bar.name}
                {bar.status !== 'active' && (
                  <BarStatusBadge status={bar.status} />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">推荐吧</h2>
        {bars.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无吧</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bars.map((bar) => (
              <Link
                key={bar.id}
                href={`/bars/${bar.id}`}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                {bar.name}
              </Link>
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
