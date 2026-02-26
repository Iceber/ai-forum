'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/admin/bars/pending', label: '待审核' },
  { href: '/admin/bars', label: '吧管理' },
  { href: '/admin/actions', label: '审计日志' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 mb-6 border-b border-gray-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            pathname === tab.href
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
