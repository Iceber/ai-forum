'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import type { Bar, PageMeta, ApiResponse } from '@/types';
import { getBrowserApiBase } from '@/lib/browser-api-base';

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
  pending_review: '待审核',
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

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending_review', label: '待审核' },
  { value: 'active', label: '正常' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'suspended', label: '已封禁' },
  { value: 'permanently_banned', label: '永久封禁' },
  { value: 'closed', label: '已关闭' },
];

interface ModalState {
  barId: string;
  barName: string;
  action: 'reject' | 'suspend' | 'ban' | 'close';
}

export default function AdminBarsPage() {
  const apiBase = getBrowserApiBase();
  const [bars, setBars] = useState<Bar[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchBars = useCallback(async (status: string, cursor?: string) => {
    const headers = getAuthHeaders();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    const url = `${apiBase}/api/admin/bars${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers });
    const json: ApiResponse<Bar[]> = await res.json();
    return json;
  }, [apiBase]);

  const loadData = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const json = await fetchBars(status);
      setBars(json.data ?? []);
      if (json.meta) setMeta(json.meta);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetchBars]);

  useEffect(() => {
    loadData(statusFilter);
  }, [statusFilter, loadData]);

  const loadMore = async () => {
    if (!meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const json = await fetchBars(statusFilter, meta.cursor);
      setBars((prev) => [...prev, ...(json.data ?? [])]);
      if (json.meta) setMeta(json.meta);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const executeAction = async (barId: string, endpoint: string, body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/bars/${barId}/${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json: ApiResponse<unknown> = await res.json();
        throw new Error(json.error?.message ?? '操作失败');
      }
      setModal(null);
      setReason('');
      setDuration('');
      await loadData(statusFilter);
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = (barId: string) => executeAction(barId, 'approve', {});

  const handleModalSubmit = () => {
    if (!modal) return;
    const { barId, action } = modal;
    switch (action) {
      case 'reject':
        return executeAction(barId, 'reject', { reason });
      case 'suspend':
        return executeAction(barId, 'suspend', { reason, duration: duration || undefined });
      case 'ban':
        return executeAction(barId, 'ban', { reason });
      case 'close':
        return executeAction(barId, 'close', { reason });
    }
  };

  const actionLabel: Record<string, string> = {
    reject: '拒绝',
    suspend: '封禁',
    ban: '永久封禁',
    close: '关闭',
  };

  const renderActions = (bar: Bar) => {
    const buttons: React.ReactNode[] = [];
    if (bar.status === 'pending_review') {
      buttons.push(
        <button key="approve" onClick={() => handleApprove(bar.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">通过</button>,
        <button key="reject" onClick={() => { setModal({ barId: bar.id, barName: bar.name, action: 'reject' }); setReason(''); }} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">拒绝</button>,
      );
    }
    if (bar.status === 'active') {
      buttons.push(
        <button key="suspend" onClick={() => { setModal({ barId: bar.id, barName: bar.name, action: 'suspend' }); setReason(''); setDuration(''); }} className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors">封禁</button>,
        <button key="ban" onClick={() => { setModal({ barId: bar.id, barName: bar.name, action: 'ban' }); setReason(''); }} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">永封</button>,
        <button key="close" onClick={() => { setModal({ barId: bar.id, barName: bar.name, action: 'close' }); setReason(''); }} className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">关闭</button>,
      );
    }
    if (bar.status === 'suspended') {
      buttons.push(
        <button key="unsuspend" onClick={() => executeAction(bar.id, 'unsuspend', {})} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">解封</button>,
        <button key="ban" onClick={() => { setModal({ barId: bar.id, barName: bar.name, action: 'ban' }); setReason(''); }} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">永封</button>,
        <button key="close" onClick={() => { setModal({ barId: bar.id, barName: bar.name, action: 'close' }); setReason(''); }} className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">关闭</button>,
      );
    }
    return buttons.length > 0 ? <div className="flex gap-1">{buttons}</div> : null;
  };

  return (
    <div>
      <AdminNav />

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">加载中…</p>
      ) : bars.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无数据</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white border border-gray-200 rounded-lg text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">吧名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">成员数</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">创建者</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">创建时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {bars.map((bar) => (
                  <tr key={bar.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{bar.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${statusColor[bar.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[bar.status] ?? bar.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{bar.memberCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{bar.createdBy?.nickname ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(bar.createdAt)}</td>
                    <td className="px-4 py-3">{renderActions(bar)}</td>
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

      {/* Action modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {actionLabel[modal.action]}：{modal.barName}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="请输入原因…"
                />
              </div>

              {modal.action === 'suspend' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">封禁时长</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：7d, 30d"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setModal(null); setReason(''); setDuration(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? '提交中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
