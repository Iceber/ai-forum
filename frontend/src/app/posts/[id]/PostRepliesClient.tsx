'use client';

import { useState } from 'react';
import type { Reply, ChildReply } from '@/types';
import ReplyItem from '@/components/reply/ReplyItem';
import useAuthStore from '@/lib/auth';
import apiClient from '@/lib/api-client';
import ImageUpload from '@/components/editor/ImageUpload';
import { appendMarkdownImage } from '@/lib/markdown-image';

interface PostRepliesClientProps {
  postId: string;
  postAuthorId?: string;
  initialReplies: Reply[];
  canModerate?: boolean;
}

export default function PostRepliesClient({
  postId,
  postAuthorId,
  initialReplies,
  canModerate,
}: PostRepliesClientProps) {
  const { user } = useAuthStore();
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [topLevelContent, setTopLevelContent] = useState('');
  const [nestedContent, setNestedContent] = useState('');
  const [nestedParentId, setNestedParentId] = useState<string | null>(null);
  const [nestedReplyToNickname, setNestedReplyToNickname] = useState('');
  const [submittingTopLevel, setSubmittingTopLevel] = useState(false);
  const [submittingNested, setSubmittingNested] = useState(false);
  const [error, setError] = useState('');

  const toChildReply = (reply: Reply, parentId: string): ChildReply => ({
    id: reply.id,
    content: reply.content,
    contentType: reply.contentType,
    author: reply.author
      ? { id: reply.author.id, nickname: reply.author.nickname }
      : null,
    createdAt: reply.createdAt,
    likeCount: reply.likeCount ?? 0,
    isLiked: false,
    isAuthor: reply.isAuthor,
    parentReplyId: reply.parentReplyId ?? parentId,
    floorNumber: reply.floorNumber,
  });

  const submitReply = async (content: string, parentReplyId?: string) => {
    const body: Record<string, string> = { content: content.trim() };
    if (parentReplyId) body.parentReplyId = parentReplyId;
    const res = await apiClient.post<Reply>(`/api/posts/${postId}/replies`, body);

    if (!parentReplyId) {
      setReplies((prev) => [...prev, res.data]);
      return;
    }

    const createdChild = toChildReply(res.data, parentReplyId);
    setReplies((prev) =>
      prev.map((reply) =>
        reply.id === parentReplyId
          ? {
              ...reply,
              childCount: (reply.childCount ?? 0) + 1,
              childPreview: [...(reply.childPreview ?? []), createdChild],
            }
          : reply,
      ),
    );
  };

  const handleSubmitTopLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topLevelContent.trim()) return;
    setSubmittingTopLevel(true);
    setError('');
    try {
      await submitReply(topLevelContent);
      setTopLevelContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmittingTopLevel(false);
    }
  };

  const handleSubmitNested = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nestedParentId || !nestedContent.trim()) return;
    setSubmittingNested(true);
    setError('');
    try {
      await submitReply(nestedContent, nestedParentId);
      setNestedContent('');
      setNestedParentId(null);
      setNestedReplyToNickname('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmittingNested(false);
    }
  };

  const handleReplyTo = (replyId: string, authorNickname: string, quotePrefix?: string) => {
    setNestedParentId(replyId);
    setNestedReplyToNickname(authorNickname);
    setNestedContent((prev) => (quotePrefix && !prev.trim() ? `${quotePrefix} ` : prev));
  };

  const handleHideReply = async (replyId: string) => {
    try {
      await apiClient.post(`/api/replies/${replyId}/hide`);
      setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
    } catch {
      setError('隐藏回复失败');
    }
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
            <div key={reply.id}>
              <ReplyItem
                reply={reply}
                postAuthorId={postAuthorId}
                onReply={user ? handleReplyTo : undefined}
                canModerate={canModerate}
                onHide={handleHideReply}
              />
              {user && nestedParentId === reply.id && (
                <form onSubmit={handleSubmitNested} className="ml-8 mt-2 bg-white rounded-lg border border-gray-200 p-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    回复 {nestedReplyToNickname}
                    <button
                      type="button"
                      onClick={() => {
                        setNestedParentId(null);
                        setNestedReplyToNickname('');
                        setNestedContent('');
                      }}
                      className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      取消
                    </button>
                  </h3>
                  <textarea
                    name="nested-reply-content"
                    value={nestedContent}
                    onChange={(e) => setNestedContent(e.target.value)}
                    placeholder="请输入回复内容…"
                    rows={3}
                    autoFocus
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="mt-2">
                    <ImageUpload
                      onUpload={(fileUrl) => {
                        setNestedContent((prev) => appendMarkdownImage(prev, fileUrl));
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingNested || !nestedContent.trim()}
                      className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingNested ? '提交中…' : '提交楼中楼回复'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Top-level reply input */}
      {user ? (
        <form onSubmit={handleSubmitTopLevel} className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">发表回复</h3>
          {error && (
            <p className="text-red-500 text-sm mb-2">{error}</p>
          )}
          <textarea
            name="reply-content"
            value={topLevelContent}
            onChange={(e) => setTopLevelContent(e.target.value)}
            placeholder="请输入回复内容…"
            rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="mt-2">
            <ImageUpload
              onUpload={(fileUrl) => {
                setTopLevelContent((prev) => appendMarkdownImage(prev, fileUrl));
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={submittingTopLevel || !topLevelContent.trim()}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submittingTopLevel ? '提交中…' : '提交回复'}
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
