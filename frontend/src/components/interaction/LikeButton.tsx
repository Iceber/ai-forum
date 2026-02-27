'use client';

import { useState } from 'react';
import api from '@/lib/api-client';

interface LikeButtonProps {
  targetType: 'post' | 'reply';
  targetId: string;
  initialLiked: boolean | null;
  initialCount: number;
}

export default function LikeButton({
  targetType,
  targetId,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked ?? false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const endpoint =
    targetType === 'post'
      ? `/api/posts/${targetId}/like`
      : `/api/replies/${targetId}/like`;

  const handleToggle = async () => {
    if (initialLiked === null) {
      window.location.href = '/login';
      return;
    }
    setLoading(true);
    const prevLiked = isLiked;
    const prevCount = count;

    // Optimistic update
    setIsLiked(!isLiked);
    setCount(isLiked ? count - 1 : count + 1);

    try {
      if (prevLiked) {
        await api.delete(endpoint);
      } else {
        await api.post(endpoint);
      }
    } catch {
      // Rollback on failure
      setIsLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
        isLiked
          ? 'text-red-500 bg-red-50 hover:bg-red-100'
          : 'text-gray-500 hover:text-red-500 hover:bg-gray-100'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span>{isLiked ? '❤️' : '🤍'}</span>
      <span>{count}</span>
    </button>
  );
}
