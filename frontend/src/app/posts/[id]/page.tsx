'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Post, Reply, ApiResponse } from '@/types';
import PostRepliesClient from './PostRepliesClient';
import LikeButton from '@/components/interaction/LikeButton';
import FavoriteButton from '@/components/interaction/FavoriteButton';
import ShareButton from '@/components/interaction/ShareButton';
import { getBrowserApiBase } from '@/lib/browser-api-base';
import useAuthStore from '@/lib/auth';
import apiClient from '@/lib/api-client';
import MarkdownContent from '@/components/editor/MarkdownContent';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PostPage() {
  const apiBase = getBrowserApiBase();
  const params = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    async function load() {
      try {
        // Use api-client for authenticated request (sends JWT token)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [postRes, repliesRes] = await Promise.all([
          fetch(`${apiBase}/api/posts/${params.id}`, { headers }),
          fetch(`${apiBase}/api/posts/${params.id}/replies?limit=50`, { headers }),
        ]);

        if (!cancelled) {
          if (!postRes.ok) {
            setNotFound(true);
          } else {
            const postJson: ApiResponse<Post> = await postRes.json();
            if (postJson.data) setPost(postJson.data);
            else setNotFound(true);
          }

          if (repliesRes.ok) {
            const repliesJson: ApiResponse<Reply[]> = await repliesRes.json();
            if (repliesJson.data) setReplies(repliesJson.data);
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
  }, [apiBase, params.id]);

  const handleDelete = async () => {
    if (!confirm('确定要删除这篇帖子吗？此操作不可恢复。')) return;
    try {
      await apiClient.delete(`/api/posts/${params.id}`);
      window.location.href = '/';
    } catch {
      alert('删除失败');
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-center py-12">加载中…</p>;
  }

  if (notFound || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">帖子不存在或已被删除</p>
        <Link href="/" className="text-blue-600 hover:underline">返回首页</Link>
      </div>
    );
  }

  const canDelete = user && (user.id === post.authorId || user.role === 'admin');

  return (
    <div>
      {/* Post detail */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          {post.bar && (
            <Link
              href={`/bars/${post.barId}`}
              className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium"
            >
              {post.bar.name}
            </Link>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{post.title}</h1>
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          <span className="font-medium text-gray-700">
            {post.author?.nickname ?? '匿名'}
          </span>
          <span>{formatDate(post.createdAt)}</span>
          <span className="ml-auto">{post.replyCount} 回复</span>
        </div>
        <div className="border-t pt-4">
          <MarkdownContent content={post.content} className="prose prose-sm max-w-none text-gray-800" />
        </div>

        {/* Interaction buttons */}
        <div className="mt-4 pt-4 border-t flex items-center gap-3">
          <LikeButton
            targetType="post"
            targetId={post.id}
            initialLiked={post.isLiked ?? null}
            initialCount={post.likeCount ?? 0}
          />
          <FavoriteButton
            postId={post.id}
            initialFavorited={post.isFavorited ?? null}
            initialCount={post.favoriteCount ?? 0}
          />
          <ShareButton postId={post.id} initialCount={post.shareCount ?? 0} />

          {canDelete && (
            <button
              onClick={handleDelete}
              className="ml-auto text-sm text-red-500 hover:text-red-700"
            >
              🗑️ 删除
            </button>
          )}
        </div>
      </div>

      {/* Replies section */}
      <PostRepliesClient
        postId={post.id}
        postAuthorId={post.authorId}
        initialReplies={replies}
      />
    </div>
  );
}
