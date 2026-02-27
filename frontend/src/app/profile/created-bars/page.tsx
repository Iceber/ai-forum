'use client';

import { useEffect, useState, useCallback } from 'react';
import ProfileNav from '@/components/profile/ProfileNav';
import type { CreatedBar, PageMeta, ApiResponse } from '@/types';
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

export default function CreatedBarsPage() {
  const [bars, setBars] = useState<CreatedBar[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchBars = useCallback(async (cursor?: string) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = cursor
      ? `${API_BASE}/api/users/me/created-bars?cursor=${cursor}`
      : `${API_BASE}/api/users/me/created-bars`;
    const res = await fetch(url, { cache: 'no-store', headers });
    const json: ApiResponse<CreatedBar[]> = await res.json();
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
        <p className="text-gray-500 text-center py-12">暂无创建的吧</p>
      ) : (
        <div className="space-y-3">
          {bars.map((bar) => (
            <div
              key={bar.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900">{bar.name}</h3>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${statusColor[bar.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {statusLabel[bar.status] ?? bar.status}
                </span>
              </div>
              {bar.statusReason && (
                <p className="text-xs text-red-500 mb-1">
                  原因：{bar.statusReason}
                </p>
              )}
              <div className="text-xs text-gray-500">
                {formatDate(bar.createdAt)}
              </div>
            </div>
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
