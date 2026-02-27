'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BarManageMenuProps {
  barId: string;
  memberRole: string;
}

export default function BarManageMenu({ barId, memberRole }: BarManageMenuProps) {
  const [open, setOpen] = useState(false);

  if (memberRole !== 'owner' && memberRole !== 'moderator') return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
      >
        ⚙️ 管理
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <Link
            href={`/bars/${barId}/edit`}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            编辑吧资料
          </Link>
          {memberRole === 'owner' && (
            <Link
              href={`/bars/${barId}/members`}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              成员管理
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
