'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import type { BarMemberItem, Bar, PageMeta } from '@/types';
import { getBrowserApiBase } from '@/lib/browser-api-base';

export default function BarMembersPage() {
  const params = useParams<{ id: string }>();
  const apiBase = getBrowserApiBase();

  const [bar, setBar] = useState<Bar | null>(null);
  const [members, setMembers] = useState<BarMemberItem[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');

  const loadMembers = useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    try {
      const queryParams: Record<string, string> = { limit: '20' };
      if (cursor) queryParams.cursor = cursor;
      if (roleFilter) queryParams.role = roleFilter;

      const res = await apiClient.get(`/api/bars/${params.id}/members`, { params: queryParams });
      const responseData = res.data as { data?: BarMemberItem[]; meta?: PageMeta } | BarMemberItem[];

      let items: BarMemberItem[];
      let newMeta: PageMeta;

      if (Array.isArray(responseData)) {
        items = responseData;
        newMeta = { hasMore: false };
      } else {
        items = responseData?.data ?? [];
        newMeta = responseData?.meta ?? { hasMore: false };
      }

      if (append) {
        setMembers((prev) => [...prev, ...items]);
      } else {
        setMembers(items);
      }
      setMeta(newMeta);
    } catch {
      setForbidden(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [params.id, roleFilter]);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    async function loadBar() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${apiBase}/api/bars/${params.id}`, { headers });
        if (!cancelled && res.ok) {
          const json = await res.json();
          setBar(json.data);
        }
      } catch {
        // ignore
      }
    }
    loadBar();
    return () => { cancelled = true; };
  }, [apiBase, params.id]);

  useEffect(() => {
    setLoading(true);
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiClient.patch(`/api/bars/${params.id}/members/${userId}/role`, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-center py-12">加载中…</p>;
  }

  if (forbidden) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">无权限查看成员列表</p>
        <Link href={`/bars/${params.id}`} className="text-blue-600 hover:underline">返回</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/bars/${params.id}`} className="text-blue-600 hover:underline text-sm">
          ← 返回 {bar?.name ?? ''}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">成员管理</h1>

      {/* Role filter */}
      <div className="flex gap-2 mb-4">
        {['', 'owner', 'moderator', 'member'].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              roleFilter === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r === '' ? '全部' : r === 'owner' ? '吧主' : r === 'moderator' ? '吧务' : '成员'}
          </button>
        ))}
      </div>

      {/* Members list */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {members.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无成员</p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500">
                  {member.nickname?.[0] ?? '?'}
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-800">{member.nickname ?? '未知用户'}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    member.role === 'owner'
                      ? 'bg-red-100 text-red-600'
                      : member.role === 'moderator'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {member.role === 'owner' ? '吧主' : member.role === 'moderator' ? '吧务' : '成员'}
                  </span>
                </div>
              </div>

              {bar?.memberRole === 'owner' && member.role !== 'owner' && (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="member">成员</option>
                  <option value="moderator">吧务</option>
                </select>
              )}
            </div>
          ))
        )}
      </div>

      {meta.hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => loadMembers(meta.cursor, true)}
            disabled={loadingMore}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {loadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
}
