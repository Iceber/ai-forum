'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ProfileNav from '@/components/profile/ProfileNav';
import type { MyPost, PageMeta, ApiResponse } from '@/types';
import { getBrowserApiBase } from '@/lib/browser-api-base';

const API_BASE = getBrowserApiBase();

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyPostsPage() {
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (cursor?: string) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = cursor
      ? `${API_BASE}/api/users/me/posts?cursor=${cursor}`
      : `${API_BASE}/api/users/me/posts`;
    const res = await fetch(url, { cache: 'no-store', headers });
    const json: ApiResponse<MyPost[]> = await res.json();
    return json;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const json = await fetchPosts();
        if (!cancelled) {
          setPosts(json.data ?? []);
          if (json.meta) setMeta(json.meta);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fetchPosts]);

  const loadMore = async () => {
    if (!meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const json = await fetchPosts(meta.cursor);
      setPosts((prev) => [...prev, ...(json.data ?? [])]);
      if (json.meta) setMeta(json.meta);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <ProfileNav />

      {loading ? (
        <p className="text-gray-500 text-center py-12">加载中…</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无帖子</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
            >
              <h3 className="font-medium text-gray-900 mb-1">{post.title}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {post.barName && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {post.barName}
                  </span>
                )}
                <span>{post.replyCount} 回复</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>
            </Link>
          ))}

          {meta.hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
