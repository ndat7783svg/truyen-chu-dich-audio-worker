'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BieuTuong from './BieuTuong';

const MUC = [
  { duongDan: '/', nhan: 'Trang chủ', icon: 'nha' },
  { duongDan: '/tu-truyen', nhan: 'Tủ truyện', icon: 'tu-sach' },
  { duongDan: '/tai-khoan', nhan: 'Tài khoản', icon: 'nguoi' },
] as const;

export default function ThanhDieuHuong() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: thanh icon nổi dọc bên trái */}
      <nav className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-md min-[1360px]:flex">
        {MUC.map((muc) => {
          const dangHoatDong = pathname === muc.duongDan;
          return (
            <div key={muc.duongDan} className="group relative">
              <Link
                href={muc.duongDan}
                aria-label={muc.nhan}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  dangHoatDong ? 'bg-accent text-on-accent' : 'text-foreground hover:bg-surface'
                }`}
              >
                <BieuTuong ten={muc.icon} />
              </Link>
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
                {muc.nhan}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Điện thoại + máy tính bảng: thanh ngang cố định dưới đáy, có chữ dưới icon */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[1360px]:hidden">
        <div className="mx-auto flex max-w-md justify-around">
          {MUC.map((muc) => {
            const dangHoatDong = pathname === muc.duongDan;
            return (
              <Link
                key={muc.duongDan}
                href={muc.duongDan}
                className={`flex min-w-16 flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium ${
                  dangHoatDong ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                <BieuTuong ten={muc.icon} className="h-5.5 w-5.5" />
                {muc.nhan}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
