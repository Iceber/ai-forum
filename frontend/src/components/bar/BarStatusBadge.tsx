'use client';

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: '活跃', className: 'bg-green-100 text-green-800' },
  pending_review: { label: '审核中', className: 'bg-yellow-100 text-yellow-800' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
  suspended: { label: '已封禁', className: 'bg-orange-100 text-orange-800' },
  permanently_banned: { label: '永久封禁', className: 'bg-red-100 text-red-800' },
  closed: { label: '已关闭', className: 'bg-gray-100 text-gray-800' },
};

export default function BarStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
