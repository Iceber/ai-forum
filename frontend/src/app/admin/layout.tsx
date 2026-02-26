'use client';

import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/auth';
import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== 'admin') router.push('/');
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">管理后台</h1>
      {children}
    </div>
  );
}
