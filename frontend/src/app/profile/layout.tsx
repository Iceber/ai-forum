'use client';

import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/auth';
import { useEffect } from 'react';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">个人中心</h1>
      {children}
    </div>
  );
}
