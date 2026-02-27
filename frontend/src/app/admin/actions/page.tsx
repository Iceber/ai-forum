'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import type { AdminAction, PageMeta, ApiResponse } from '@/types';

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

const actionLabel: Record<string, string> = {
  approve_bar: '通过审核',
  reject_bar: '拒绝审核',
  suspend_bar: '封禁吧',
  unsuspend_bar: '解封吧',
  ban_bar: '永久封禁吧',
  close_bar: '关闭吧',
};

export default function AdminActionsPage() {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchActions = useCallback(async (cursor?: string) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    const url = `${API_BASE}/api/admin/actions${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers });
    const json: ApiResponse<AdminAction[]> = await res.json();
    return json;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const json = await fetchActions();
        if (!cancelled) {
          setActions(json.data ?? []);
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
  }, [fetchActions]);

  const loadMore = async () => {
    if (!meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const json = await fetchActions(meta.cursor);
      setActions((prev) => [...prev, ...(json.data ?? [])]);
      if (json.meta) setMeta(json.meta);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <AdminNav />

      {loading ? (
        <p className="text-gray-500 text-center py-12">加载中…</p>
      ) : actions.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无操作记录</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white border border-gray-200 rounded-lg text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">操作</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">目标</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">管理员</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">原因</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">时间</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr key={action.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {actionLabel[action.action] ?? action.action}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {action.targetName ?? action.targetId}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {action.adminNickname ?? action.adminId}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={action.reason ?? ''}>
                      {action.reason ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(action.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
        </>
      )}
    </div>
  );
}
