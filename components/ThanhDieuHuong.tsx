'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MUC: { duongDan: string; nhan: string; icon: ReactNode }[] = [
  {
    duongDan: '/',
    nhan: 'Trang chủ',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    duongDan: '/tai-khoan',
    nhan: 'Tài khoản',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    duongDan: '/tu-truyen',
    nhan: 'Tủ truyện',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
];

export default function ThanhDieuHuong() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: icon nổi dọc bên trái */}
      <nav className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2 p-2 rounded-full border border-border bg-surface shadow-md">
        {MUC.map((muc) => {
          const dangHoatDong = pathname === muc.duongDan;
          return (
            <div key={muc.duongDan} className="group relative">
              <Link
                href={muc.duongDan}
                aria-label={muc.nhan}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  dangHoatDong
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-background'
                }`}
              >
                {muc.icon}
              </Link>
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {muc.nhan}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Mobile: thanh ngang cố định dưới đáy */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 justify-center gap-6 border-t border-border bg-surface py-2 shadow-md">
        {MUC.map((muc) => {
          const dangHoatDong = pathname === muc.duongDan;
          return (
            <Link
              key={muc.duongDan}
              href={muc.duongDan}
              aria-label={muc.nhan}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                dangHoatDong
                  ? 'bg-foreground text-background'
                  : 'text-foreground hover:bg-background'
              }`}
            >
              {muc.icon}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
