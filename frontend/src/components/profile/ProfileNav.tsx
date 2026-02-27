'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/profile', label: '我的帖子' },
  { href: '/profile/replies', label: '我的回复' },
  { href: '/profile/bars', label: '我的吧' },
  { href: '/profile/created-bars', label: '我创建的吧' },
];

export default function ProfileNav() {
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
      <Link
        href="/profile/edit"
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ml-auto ${
          pathname === '/profile/edit'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        编辑资料
      </Link>
    </nav>
  );
}
