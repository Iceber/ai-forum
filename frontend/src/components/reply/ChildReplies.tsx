'use client';

import { useState } from 'react';
import api from '@/lib/api-client';
import { ChildReply } from '@/types';
import LikeButton from '@/components/interaction/LikeButton';

interface ChildRepliesProps {
  parentReplyId: string;
  childCount: number;
  initialPreview: ChildReply[];
  postAuthorId?: string;
}

export default function ChildReplies({
  parentReplyId,
  childCount,
  initialPreview,
  postAuthorId,
}: ChildRepliesProps) {
  const [children, setChildren] = useState<ChildReply[]>(initialPreview);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(childCount > 3);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '10' };
      if (cursor) params.cursor = cursor;

      const res = await api.get(`/replies/${parentReplyId}/children`, { params });
      const newChildren: ChildReply[] = res.data?.data ?? res.data ?? [];
      const meta = res.data?.meta;

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
          <p className="text-gray-600">{child.content}</p>
          <div className="mt-1">
            <LikeButton
              targetType="reply"
              targetId={child.id}
              initialLiked={child.isLiked ?? null}
              initialCount={child.likeCount ?? 0}
            />
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
