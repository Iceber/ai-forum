'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MyFavorite, PageMeta } from '@/types';
import apiClient from '@/lib/api-client';
import ProfileNav from '@/components/profile/ProfileNav';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<MyFavorite[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async (cursor?: string) => {
    try {
      const params: Record<string, string> = { limit: '20' };
      if (cursor) params.cursor = cursor;
      const res = await apiClient.get('/api/users/me/favorites', { params });
      const data = res.data?.data ?? res.data ?? [];
      const resMeta = res.data?.meta ?? null;

      if (cursor) {
        setFavorites((prev) => [...prev, ...data]);
      } else {
        setFavorites(data);
      }
      setMeta(resMeta);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleUnfavorite = async (postId: string, favId: string) => {
    try {
      await apiClient.delete(`/api/posts/${postId}/favorite`);
      setFavorites((prev) => prev.filter((f) => f.id !== favId));
    } catch {
      alert('取消收藏失败');
    }
  };

  return (
    <div>
      <ProfileNav />
      <h2 className="text-lg font-semibold text-gray-800 mb-4">我的收藏</h2>

      {loading ? (
        <p className="text-gray-500 text-center py-8">加载中...</p>
      ) : favorites.length === 0 ? (
        <p className="text-gray-500 text-center py-8">暂无收藏</p>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
            >
              <div>
                <Link
                  href={`/posts/${fav.postId}`}
                  className="text-gray-900 font-medium hover:text-blue-600"
                >
                  {fav.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  {fav.barName && <span>{fav.barName}</span>}
                  {fav.authorNickname && <span>· {fav.authorNickname}</span>}
                  <span>
                    · 收藏于{' '}
                    {new Date(fav.favoritedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleUnfavorite(fav.postId, fav.id)}
                className="text-sm text-gray-400 hover:text-red-500"
              >
                取消收藏
              </button>
            </div>
          ))}

          {meta?.hasMore && (
            <button
              onClick={() => loadFavorites(meta.cursor)}
              className="w-full py-3 text-sm text-blue-600 hover:text-blue-800"
            >
              加载更多
            </button>
          )}
        </div>
      )}
    </div>
  );
}
