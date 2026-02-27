'use client';

import { useState } from 'react';
import api from '@/lib/api-client';

interface ShareButtonProps {
  postId: string;
  initialCount: number;
}

export default function ShareButton({ postId, initialCount }: ShareButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/posts/${postId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      const res = await api.post(`/posts/${postId}/share`);
      if (res.data?.shareCount !== undefined) {
        setCount(res.data.shareCount);
      } else {
        setCount((c) => c + 1);
      }
    } catch {
      // Silent fail for clipboard/share
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-500 hover:text-blue-500 hover:bg-gray-100 transition-colors"
    >
      <span>🔗</span>
      <span>{copied ? '已复制' : count}</span>
    </button>
  );
}
