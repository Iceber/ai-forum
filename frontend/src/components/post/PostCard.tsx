import Link from 'next/link';

interface PostCardProps {
  id: string;
  title: string;
  content: string;
  authorNickname: string;
  barName: string;
  barId: string;
  replyCount: number;
  likeCount?: number;
  favoriteCount?: number;
  createdAt: string;
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

export default function PostCard({
  id,
  title,
  content,
  authorNickname,
  barName,
  barId,
  replyCount,
  likeCount,
  favoriteCount,
  createdAt,
}: PostCardProps) {
  const preview = content.length > 100 ? content.slice(0, 100) + '…' : content;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <Link href={`/posts/${id}`} className="block group">
        <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{preview}</p>
      </Link>

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <Link
          href={`/bars/${barId}`}
          className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {barName}
        </Link>
        <span>{authorNickname}</span>
        <span>{formatDate(createdAt)}</span>
        <span className="ml-auto flex items-center gap-2">
          {(likeCount ?? 0) > 0 && <span>❤️ {likeCount}</span>}
          {(favoriteCount ?? 0) > 0 && <span>⭐ {favoriteCount}</span>}
          <span>{replyCount} 回复</span>
        </span>
      </div>
    </div>
  );
}
