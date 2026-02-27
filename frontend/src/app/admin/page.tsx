'use client';

import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Link
        href="/admin/bars/pending"
        className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-1">待审核</h2>
        <p className="text-sm text-gray-500">审核新创建的吧</p>
      </Link>

      <Link
        href="/admin/bars"
        className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-1">吧管理</h2>
        <p className="text-sm text-gray-500">管理所有吧的状态</p>
      </Link>

      <Link
        href="/admin/actions"
        className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-1">审计日志</h2>
        <p className="text-sm text-gray-500">查看管理操作记录</p>
      </Link>
    </div>
  );
}
