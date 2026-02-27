'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Bar, Post, PageMeta, ApiResponse } from '@/types';
import BarPostsClient from './BarPostsClient';
import BarStatusBadge from '@/components/bar/BarStatusBadge';
import JoinBarButton from '@/components/bar/JoinBarButton';
import useAuthStore from '@/lib/auth';
import { getBrowserApiBase } from '@/lib/browser-api-base';

const API_BASE = getBrowserApiBase();

export default function BarPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [bar, setBar] = useState<Bar | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ hasMore: false });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    async function load() {
      try {
        const headers: Record<string, string> = {};
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [barRes, postsRes] = await Promise.all([
          fetch(`${API_BASE}/api/bars/${params.id}`, { headers }),
          fetch(`${API_BASE}/api/posts?barId=${params.id}&limit=20`),
        ]);

        if (!cancelled) {
          if (!barRes.ok) {
            setNotFound(true);
          } else {
            const barJson: ApiResponse<Bar> = await barRes.json();
            if (barJson.data) setBar(barJson.data);
            else setNotFound(true);
          }

          if (postsRes.ok) {
            const postsJson: ApiResponse<Post[]> = await postsRes.json();
            if (postsJson.data) setPosts(postsJson.data);
            if (postsJson.meta) setMeta(postsJson.meta);
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  const handleMembershipChange = (isMember: boolean) => {
    if (bar) {
      setBar({
        ...bar,
        isMember,
        memberCount: (bar.memberCount ?? 0) + (isMember ? 1 : -1),
      });
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-center py-12">加载中…</p>;
  }

  if (notFound || !bar) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">板块不存在</p>
        <Link href="/" className="text-blue-600 hover:underline">返回首页</Link>
      </div>
    );
  }

  const isReadOnly = ['suspended', 'permanently_banned', 'closed'].includes(bar.status);

  return (
    <div>
      {/* Status banner for non-active bars */}
      {bar.status !== 'active' && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${
          bar.status === 'suspended' ? 'bg-orange-50 text-orange-800 border border-orange-200' :
          bar.status === 'permanently_banned' ? 'bg-red-50 text-red-800 border border-red-200' :
          bar.status === 'closed' ? 'bg-gray-50 text-gray-800 border border-gray-200' :
          'bg-yellow-50 text-yellow-800 border border-yellow-200'
        }`}>
          <BarStatusBadge status={bar.status} />
          <span className="ml-2">
            {bar.status === 'suspended' && '该吧已被临时封禁，内容仅可浏览'}
            {bar.status === 'permanently_banned' && '该吧已被永久封禁，内容仅可浏览'}
            {bar.status === 'closed' && '该吧已关闭归档，内容仅可浏览'}
            {bar.status === 'pending_review' && '该吧正在等待审核'}
            {bar.status === 'rejected' && '该吧创建申请已被拒绝'}
          </span>
          {bar.statusReason && (
            <p className="mt-1 text-xs opacity-75">原因：{bar.statusReason}</p>
          )}
          {bar.status === 'suspended' && bar.suspendUntil && (
            <p className="mt-1 text-xs opacity-75">
              解封时间：{new Date(bar.suspendUntil).toLocaleString('zh-CN')}
            </p>
          )}
        </div>
      )}

      {/* Bar info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{bar.name}</h1>
              {bar.status !== 'active' && <BarStatusBadge status={bar.status} />}
            </div>
            {bar.description && (
              <p className="mt-1 text-gray-500 text-sm">{bar.description}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
              {bar.memberCount !== undefined && (
                <span>{bar.memberCount} 名成员</span>
              )}
              {bar.createdBy && (
                <span>创建者：{bar.createdBy.nickname}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {user && (
              <JoinBarButton
                barId={bar.id}
                isMember={bar.isMember ?? null}
                memberRole={bar.memberRole ?? null}
                barStatus={bar.status}
                onMembershipChange={handleMembershipChange}
              />
            )}
            {!isReadOnly && (
              <Link
                href={`/create-post?barId=${bar.id}`}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                在此发帖
              </Link>
            )}
            {isReadOnly && (
              <button
                disabled
                className="px-4 py-2 bg-gray-300 text-gray-500 text-sm rounded cursor-not-allowed"
                title="该吧当前状态不允许发帖"
              >
                在此发帖
              </button>
            )}
          </div>
        </div>
      </div>

      <BarPostsClient initialPosts={posts} initialMeta={meta} barId={bar.id} />
    </div>
  );
}
