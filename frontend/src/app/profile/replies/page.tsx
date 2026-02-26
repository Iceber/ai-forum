'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ProfileNav from '@/components/profile/ProfileNav';
import type { MyReply, PageMeta, ApiResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyRepliesPage() {
  const [replies, setReplies] = useState<MyReply[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchReplies = useCallback(async (cursor?: string) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = cursor
      ? `${API_BASE}/api/users/me/replies?cursor=${cursor}`
      : `${API_BASE}/api/users/me/replies`;
    const res = await fetch(url, { headers });
    const json: ApiResponse<MyReply[]> = await res.json();
    return json;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const json = await fetchReplies();
        if (!cancelled) {
          setReplies(json.data ?? []);
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
  }, [fetchReplies]);

  const loadMore = async () => {
    if (!meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const json = await fetchReplies(meta.cursor);
      setReplies((prev) => [...prev, ...(json.data ?? [])]);
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
      ) : replies.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无回复</p>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <Link
              key={reply.id}
              href={`/posts/${reply.postId}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
            >
              <p className="text-gray-800 text-sm mb-2 line-clamp-2">
                {reply.content}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {reply.postTitle && (
                  <span className="truncate max-w-[200px]" title={reply.postTitle}>
                    回复于：{reply.postTitle}
                  </span>
                )}
                {reply.barName && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {reply.barName}
                  </span>
                )}
                <span>#{reply.floorNumber}</span>
                <span>{formatDate(reply.createdAt)}</span>
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
