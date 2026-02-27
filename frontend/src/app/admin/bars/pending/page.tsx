'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import type { Bar, PageMeta, ApiResponse } from '@/types';
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

export default function PendingBarsPage() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchBars = useCallback(async (cursor?: string) => {
    const headers = getAuthHeaders();
    const params = new URLSearchParams({ status: 'pending_review' });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`${API_BASE}/api/admin/bars?${params}`, { headers });
    const json: ApiResponse<Bar[]> = await res.json();
    return json;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetchBars();
      setBars(json.data ?? []);
      if (json.meta) setMeta(json.meta);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetchBars]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleApprove = async (barId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bars/${barId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const json: ApiResponse<unknown> = await res.json();
        throw new Error(json.error?.message ?? '操作失败');
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bars/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const json: ApiResponse<unknown> = await res.json();
        throw new Error(json.error?.message ?? '操作失败');
      }
      setRejectTarget(null);
      setReason('');
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <AdminNav />

      {loading ? (
        <p className="text-gray-500 text-center py-12">加载中…</p>
      ) : bars.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无待审核的吧</p>
      ) : (
        <div className="space-y-4">
          {bars.map((bar) => (
            <div
              key={bar.id}
              className="bg-white rounded-lg border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg">{bar.name}</h3>
                  {bar.description && (
                    <p className="text-sm text-gray-600 mt-1">{bar.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                    <span>创建者：{bar.createdBy?.nickname ?? '-'}</span>
                    <span>{formatDate(bar.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => handleApprove(bar.id)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => { setRejectTarget({ id: bar.id, name: bar.name }); setReason(''); }}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    拒绝
                  </button>
                </div>
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

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              拒绝：{rejectTarget.name}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">拒绝原因</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="请输入拒绝原因…"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setRejectTarget(null); setReason(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? '提交中…' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
