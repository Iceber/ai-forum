'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import type { Bar } from '@/types';
import { getBrowserApiBase } from '@/lib/browser-api-base';

export default function BarEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const apiBase = getBrowserApiBase();

  const [bar, setBar] = useState<Bar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [category, setCategory] = useState('');
  const [memberRole, setMemberRole] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    async function load() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${apiBase}/api/bars/${params.id}`, { headers });
        if (!cancelled && res.ok) {
          const json = await res.json();
          const barData: Bar = json.data;
          setBar(barData);
          setDescription(barData.description ?? '');
          setRules(barData.rules ?? '');
          setCategory(barData.category ?? '');
          setMemberRole(barData.memberRole ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [apiBase, params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body: Record<string, string> = {};
      if (description !== (bar?.description ?? '')) body.description = description;
      if (rules !== (bar?.rules ?? '')) body.rules = rules;
      if (memberRole === 'owner' && category !== (bar?.category ?? '')) {
        body.category = category;
      }

      await apiClient.patch(`/api/bars/${params.id}`, body);
      setSuccess('保存成功');
      setTimeout(() => router.push(`/bars/${params.id}`), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-center py-12">加载中…</p>;
  }

  if (!bar || (memberRole !== 'owner' && memberRole !== 'moderator')) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">无权限编辑该吧</p>
        <Link href="/" className="text-blue-600 hover:underline">返回首页</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/bars/${params.id}`} className="text-blue-600 hover:underline text-sm">
          ← 返回 {bar.name}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">编辑吧资料</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">吧名</label>
          <p className="text-gray-500 text-sm bg-gray-50 rounded px-3 py-2">{bar.name}</p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">简介</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label htmlFor="rules" className="block text-sm font-medium text-gray-700 mb-1">吧规</label>
          <textarea
            id="rules"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={5}
            maxLength={5000}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {memberRole === 'owner' && (
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              分类 <span className="text-xs text-gray-400">（仅吧主可修改）</span>
            </label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={100}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中…' : '保存修改'}
          </button>
        </div>
      </form>
    </div>
  );
}
