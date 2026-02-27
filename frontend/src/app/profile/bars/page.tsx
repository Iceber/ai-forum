'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ProfileNav from '@/components/profile/ProfileNav';
import type { MyBar, PageMeta, ApiResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const statusLabel: Record<string, string> = {
  active: '正常',
  pending_review: '审核中',
  rejected: '已拒绝',
  suspended: '已封禁',
  permanently_banned: '永久封禁',
  closed: '已关闭',
};

const statusColor: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  pending_review: 'bg-yellow-50 text-yellow-700',
  rejected: 'bg-red-50 text-red-700',
  suspended: 'bg-orange-50 text-orange-700',
  permanently_banned: 'bg-red-50 text-red-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function MyBarsPage() {
  const [bars, setBars] = useState<MyBar[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchBars = useCallback(async (cursor?: string) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = cursor
      ? `${API_BASE}/api/users/me/bars?cursor=${cursor}`
      : `${API_BASE}/api/users/me/bars`;
    const res = await fetch(url, { cache: 'no-store', headers });
    const json: ApiResponse<MyBar[]> = await res.json();
    return json;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const json = await fetchBars();
        if (!cancelled) {
          setBars(json.data ?? []);
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
  }, [fetchBars]);

  const loadMore = async () => {
    if (!meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const json = await fetchBars(meta.cursor);
      setBars((prev) => [...prev, ...(json.data ?? [])]);
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
      ) : bars.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂未加入任何吧</p>
      ) : (
        <div className="space-y-3">
          {bars.map((bar) => (
            <Link
              key={bar.id}
              href={`/bars/${bar.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900">{bar.name}</h3>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${statusColor[bar.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {statusLabel[bar.status] ?? bar.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{bar.memberCount} 成员</span>
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
