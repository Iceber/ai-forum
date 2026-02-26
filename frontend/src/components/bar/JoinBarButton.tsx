'use client';

import { useState } from 'react';
import apiClient from '@/lib/api-client';
import useAuthStore from '@/lib/auth';

interface JoinBarButtonProps {
  barId: string;
  isMember: boolean | null;
  memberRole: string | null;
  barStatus: string;
  onMembershipChange: (isMember: boolean) => void;
}

export default function JoinBarButton({
  barId,
  isMember,
  memberRole,
  barStatus,
  onMembershipChange,
}: JoinBarButtonProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const isDisabled =
    barStatus === 'permanently_banned' ||
    barStatus === 'closed' ||
    barStatus === 'pending_review' ||
    barStatus === 'rejected';

  const handleJoin = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/api/bars/${barId}/join`);
      onMembershipChange(true);
    } catch (e: any) {
      setError(e.message || '加入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('确认退出该吧？')) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/api/bars/${barId}/leave`);
      onMembershipChange(false);
    } catch (e: any) {
      setError(e.message || '退出失败');
    } finally {
      setLoading(false);
    }
  };

  if (isDisabled) {
    return (
      <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 text-sm rounded cursor-not-allowed">
        {isMember ? '已加入' : '加入吧'}
      </button>
    );
  }

  return (
    <div>
      {isMember ? (
        <button
          onClick={handleLeave}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? '处理中…' : '退出吧'}
        </button>
      ) : (
        <button
          onClick={handleJoin}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '处理中…' : '加入吧'}
        </button>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
