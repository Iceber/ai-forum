interface ReplyItemProps {
  floorNumber: number;
  content: string;
  authorNickname: string;
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

export default function ReplyItem({
  floorNumber,
  content,
  authorNickname,
  createdAt,
}: ReplyItemProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        <span className="px-2 py-0.5 bg-gray-100 rounded font-mono font-semibold text-gray-600">
          #{floorNumber}
        </span>
        <span className="font-medium text-gray-700">{authorNickname}</span>
        <span className="ml-auto">{formatDate(createdAt)}</span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{content}</p>
    </div>
  );
}
