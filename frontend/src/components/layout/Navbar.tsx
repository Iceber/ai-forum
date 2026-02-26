'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/auth';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700">
          AI Forum
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/create-post"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            发帖
          </Link>

          {user ? (
            <>
              <span className="text-sm text-gray-700 font-medium">{user.nickname}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                登录
              </Link>
              <Link href="/register" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
