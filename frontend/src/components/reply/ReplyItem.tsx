import LikeButton from '@/components/interaction/LikeButton';
import ChildReplies from '@/components/reply/ChildReplies';
import type { Reply } from '@/types';

interface ReplyItemProps {
  reply: Reply;
  postAuthorId?: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReplyItem({ reply, postAuthorId }: ReplyItemProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        {reply.floorNumber !== null && reply.floorNumber !== undefined && (
          <span className="px-2 py-0.5 bg-gray-100 rounded font-mono font-semibold text-gray-600">
            #{reply.floorNumber}
          </span>
        )}
        <span className="font-medium text-gray-700">
          {reply.author?.nickname ?? '匿名'}
        </span>
        {reply.isAuthor && (
          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
            楼主
          </span>
        )}
        <span className="ml-auto">{formatDate(reply.createdAt)}</span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.content}</p>

      <div className="mt-2 flex items-center gap-2">
        <LikeButton
          targetType="reply"
          targetId={reply.id}
          initialLiked={reply.isLiked ?? null}
          initialCount={reply.likeCount ?? 0}
        />
      </div>

      {/* Child replies (楼中楼) */}
      {(reply.childCount ?? 0) > 0 && (
        <ChildReplies
          parentReplyId={reply.id}
          childCount={reply.childCount ?? 0}
          initialPreview={reply.childPreview ?? []}
          postAuthorId={postAuthorId}
        />
      )}
    </div>
  );
}
