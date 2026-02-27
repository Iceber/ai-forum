'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Bar, Post, PageMeta, ApiResponse } from '@/types';
import BarPostsClient from './BarPostsClient';
import { getBrowserApiBase } from '@/lib/browser-api-base';

const API_BASE = getBrowserApiBase();

export default function BarPage() {
  const params = useParams<{ id: string }>();
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
        const [barRes, postsRes] = await Promise.all([
          fetch(`${API_BASE}/api/bars/${params.id}`),
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

  return (
    <div>
      {/* Bar info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{bar.name}</h1>
            {bar.description && (
              <p className="mt-1 text-gray-500 text-sm">{bar.description}</p>
            )}
          </div>
          <Link
            href={`/create-post?barId=${bar.id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors shrink-0 ml-4"
          >
            在此发帖
          </Link>
        </div>
      </div>

      <BarPostsClient initialPosts={posts} initialMeta={meta} barId={bar.id} />
    </div>
  );
}
