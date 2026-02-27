'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import useAuthStore from '@/lib/auth';
import type { Bar, Post } from '@/types';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import ImageUpload from '@/components/editor/ImageUpload';
import { appendMarkdownImage } from '@/lib/markdown-image';

function CreatePostForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [bars, setBars] = useState<Bar[]>([]);
  const [barId, setBarId] = useState(searchParams.get('barId') ?? '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'plaintext' | 'markdown'>('plaintext');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [barsLoading, setBarsLoading] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await apiClient.get<Bar[]>('/api/bars');
        setBars(res.data);
      } catch {
        // ignore
      } finally {
        setBarsLoading(false);
      }
    };
    fetchBars();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barId) {
      setError('请选择一个板块');
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post<Post>('/api/posts', {
        barId,
        title,
        content,
        contentType,
      });
      router.push(`/posts/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发帖失败');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">发帖</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              选择板块
            </label>
            <select
              value={barId}
              onChange={(e) => setBarId(e.target.value)}
              required
              disabled={barsLoading}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- 请选择板块 --</option>
              {bars.map((bar) => (
                <option key={bar.id} value={bar.id}>
                  {bar.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              内容
            </label>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-600">格式：</label>
              <button
                type="button"
                onClick={() => setContentType(contentType === 'plaintext' ? 'markdown' : 'plaintext')}
                className={`text-xs px-2 py-1 rounded ${contentType === 'markdown' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
              >
                {contentType === 'markdown' ? 'Markdown' : '纯文本'}
              </button>
            </div>
            {contentType === 'markdown' ? (
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder="请输入 Markdown 内容…"
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={8}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="请输入内容…"
              />
            )}
            <div className="mt-2">
              <ImageUpload
                onUpload={(fileUrl) => {
                  setContent((prev) => appendMarkdownImage(prev, fileUrl));
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? '提交中…' : '发布帖子'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CreatePostPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-500">加载中…</div>}>
      <CreatePostForm />
    </Suspense>
  );
}
