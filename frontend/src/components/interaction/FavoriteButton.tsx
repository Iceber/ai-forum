'use client';

import { useState } from 'react';
import api from '@/lib/api-client';

interface FavoriteButtonProps {
  postId: string;
  initialFavorited: boolean | null;
  initialCount: number;
}

export default function FavoriteButton({
  postId,
  initialFavorited,
  initialCount,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited ?? false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (initialFavorited === null) {
      window.location.href = '/login';
      return;
    }
    setLoading(true);
    const prevFav = isFavorited;
    const prevCount = count;

    setIsFavorited(!isFavorited);
    setCount(isFavorited ? count - 1 : count + 1);

    try {
      if (prevFav) {
        await api.delete(`/api/posts/${postId}/favorite`);
      } else {
        await api.post(`/api/posts/${postId}/favorite`);
      }
    } catch {
      setIsFavorited(prevFav);
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
        isFavorited
          ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
          : 'text-gray-500 hover:text-yellow-500 hover:bg-gray-100'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span>{isFavorited ? '⭐' : '☆'}</span>
      <span>{count}</span>
    </button>
  );
}
