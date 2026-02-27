'use client';

import { useState, useRef } from 'react';
import type { Reply } from '@/types';
import ReplyItem from '@/components/reply/ReplyItem';
import useAuthStore from '@/lib/auth';
import apiClient from '@/lib/api-client';

interface PostRepliesClientProps {
  postId: string;
  postAuthorId?: string;
  initialReplies: Reply[];
}

export default function PostRepliesClient({
  postId,
  postAuthorId,
  initialReplies,
}: PostRepliesClientProps) {
  const { user } = useAuthStore();
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToNickname, setReplyingToNickname] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, string> = { content: content.trim() };
      if (replyingTo) body.parentReplyId = replyingTo;

      const res = await apiClient.post<Reply>(`/api/posts/${postId}/replies`, body);
      if (!replyingTo) {
        setReplies((prev) => [...prev, res.data]);
      }
      setContent('');
      setReplyingTo(null);
      setReplyingToNickname('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyTo = (replyId: string, authorNickname: string) => {
    setReplyingTo(replyId);
    setReplyingToNickname(authorNickname);
    textareaRef.current?.focus();
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        全部回复（{replies.length}）
      </h2>

      {replies.length === 0 ? (
        <p className="text-gray-500 text-center py-8 bg-white rounded-lg border border-gray-200">
          暂无回复，快来抢沙发！
        </p>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              postAuthorId={postAuthorId}
              onReply={user ? handleReplyTo : undefined}
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      {user ? (
        <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {replyingTo ? `回复 ${replyingToNickname}` : '发表回复'}
            {replyingTo && (
              <button
                type="button"
                onClick={() => { setReplyingTo(null); setReplyingToNickname(''); }}
                className="ml-2 text-xs text-gray-400 hover:text-gray-600"
              >
                取消
              </button>
            )}
          </h3>
          {error && (
            <p className="text-red-500 text-sm mb-2">{error}</p>
          )}
          <textarea
            ref={textareaRef}
            name="reply-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入回复内容…"
            rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '提交中…' : '提交回复'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500">
          <a href="/login" className="text-blue-600 hover:underline">登录</a> 后才能发表回复
        </div>
      )}
    </div>
  );
}
