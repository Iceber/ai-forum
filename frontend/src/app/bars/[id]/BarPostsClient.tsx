'use client';

import { useState } from 'react';
import type { Post, PageMeta, ApiResponse } from '@/types';
import PostCard from '@/components/post/PostCard';
import { getBrowserApiBase } from '@/lib/browser-api-base';

interface BarPostsClientProps {
  initialPosts: Post[];
  initialMeta: PageMeta;
  barId: string;
}

export default function BarPostsClient({
  initialPosts,
  initialMeta,
  barId,
}: BarPostsClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [meta, setMeta] = useState<PageMeta>(initialMeta);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (!meta.hasMore || loading) return;
    setLoading(true);
    try {
      const base = getBrowserApiBase();
      const url = `${base}/api/posts?barId=${barId}&cursor=${meta.cursor ?? ''}&limit=20`;
      const res = await fetch(url);
      const json: ApiResponse<Post[]> = await res.json();
      if (json.data) {
        setPosts((prev) => [...prev, ...json.data!]);
        setMeta(json.meta ?? { hasMore: false });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">帖子列表</h2>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">暂无帖子</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              title={post.title}
              content={post.content}
              authorNickname={post.author?.nickname ?? '匿名'}
              barName={post.bar?.name ?? '未知板块'}
              barId={post.barId}
              replyCount={post.replyCount}
              createdAt={post.createdAt}
            />
          ))}
        </div>
      )}

      {meta.hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
}
