'use client';

import { useEffect, useState } from 'react';
import { ChildReply } from '@/types';
import LikeButton from '@/components/interaction/LikeButton';
import MarkdownContent from '@/components/editor/MarkdownContent';
import { getBrowserApiBase } from '@/lib/browser-api-base';

interface ChildRepliesProps {
  parentReplyId: string;
  childCount: number;
  initialPreview: ChildReply[];
  postAuthorId?: string;
  onReply?: (
    replyId: string,
    authorNickname: string,
    quotePrefix?: string,
  ) => void;
}

export default function ChildReplies({
  parentReplyId,
  childCount,
  initialPreview,
  postAuthorId,
  onReply,
}: ChildRepliesProps) {
  const apiBase = getBrowserApiBase();
  const [children, setChildren] = useState<ChildReply[]>(initialPreview);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(childCount > 3);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setChildren((prev) => {
      if (!expanded) return initialPreview;
      const existingIds = new Set(prev.map((child) => child.id));
      const merged = [...prev];
      for (const child of initialPreview) {
        if (!existingIds.has(child.id)) merged.push(child);
      }
      return merged;
    });
    if (!expanded) setHasMore(childCount > initialPreview.length);
  }, [initialPreview, childCount, expanded]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '10' };
      if (cursor) params.cursor = cursor;
      const query = new URLSearchParams(params).toString();
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/api/replies/${parentReplyId}/children?${query}`, {
        headers,
      });
      if (!res.ok) throw new Error('Failed to load child replies');
      const json = await res.json();
      const newChildren: ChildReply[] = json.data ?? [];
      const meta = json.meta;

      setChildren((prev) => {
        if (!expanded) return newChildren;
        const existingIds = new Set(prev.map((c) => c.id));
        const unique = newChildren.filter((c) => !existingIds.has(c.id));
        return [...prev, ...unique];
      });
      setCursor(meta?.cursor ?? null);
      setHasMore(meta?.hasMore ?? false);
      setExpanded(true);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (childCount === 0 && initialPreview.length === 0) return null;

  return (
    <div className="ml-8 mt-2 border-l-2 border-gray-200 pl-4">
      {children.map((child) => (
        <div key={child.id} className="py-2 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-700">
              {child.author?.nickname ?? '匿名用户'}
            </span>
            {postAuthorId && child.author?.id === postAuthorId && (
              <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">
                楼主
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(child.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
          <MarkdownContent content={child.content} className="text-gray-600 text-sm" />
          <div className="mt-1 flex items-center gap-2">
            <LikeButton
              targetType="reply"
              targetId={child.id}
              initialLiked={child.isLiked ?? null}
              initialCount={child.likeCount ?? 0}
            />
            {onReply && (
              <button
                onClick={() =>
                  onReply(
                    parentReplyId,
                    child.author?.nickname ?? '匿名用户',
                    `@${child.author?.nickname ?? '匿名用户'}`,
                  )
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-500 hover:text-blue-500 hover:bg-gray-100 transition-colors"
              >
                💬 回复
              </button>
            )}
          </div>
        </div>
      ))}
      {(hasMore || (!expanded && childCount > 3)) && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="text-sm text-blue-500 hover:text-blue-700 mt-1"
        >
          {loading
            ? '加载中...'
            : `查看剩余 ${childCount - children.length} 条回复`}
        </button>
      )}
    </div>
  );
}
