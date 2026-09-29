import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { dinhDangSoRutGon } from '@/lib/utils/format';
import BieuTuong from './BieuTuong';
import { BiaTruyen, type TruyenThe } from './TheTruyen';

// Các khối giao diện của trang chủ (tách khỏi app/page.tsx cho file trang chỉ lo lấy dữ liệu).

export function TieuDeMuc({ children, phai }: { children: ReactNode; phai?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <h2 className="text-lg font-bold">{children}</h2>
      {phai}
    </div>
  );
}

export function TruyenNoiBat({
  truyen,
  moTa,
}: {
  truyen: TruyenThe;
  moTa: string | null;
}) {
  return (
    <Link
      href={`/truyen/${truyen.slug}`}
      className="group relative flex gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4"
    >
      {truyen.anhBia && (
        <Image
          src={truyen.anhBia}
          alt=""
          fill
          sizes="600px"
          className="object-cover opacity-15 blur-2xl"
          aria-hidden="true"
        />
      )}
      <BiaTruyen truyen={truyen} sizes="144px" className="relative w-28 shrink-0 shadow-md sm:w-36" />
      <div className="relative flex min-w-0 flex-col">
        <span className="flex items-center gap-1 text-xs font-semibold text-rank">
          <BieuTuong ten="lua" className="h-3.5 w-3.5" /> Mới lên kệ
        </span>
        <h2 className="mt-1 line-clamp-2 text-lg font-bold leading-snug group-hover:text-accent sm:text-xl">
          {truyen.ten}
        </h2>
        {truyen.tacGia && <p className="mt-0.5 truncate text-sm text-muted-foreground">{truyen.tacGia}</p>}
        {moTa && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground sm:line-clamp-4">{moTa}</p>
        )}
        <div className="mt-auto flex items-center gap-3 whitespace-nowrap pt-3 text-xs text-muted-foreground">
          <span>{truyen.soChuong ?? 0} chương</span>
          <span className="flex items-center gap-0.5">
            <BieuTuong ten="mat" className="h-3.5 w-3.5" />
            {dinhDangSoRutGon(truyen.luotXem ?? 0)}
          </span>
          <span className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent">
            Đọc ngay
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BangXepHang({ dsTruyen }: { dsTruyen: TruyenThe[] }) {
  return (
    <ol className="divide-y divide-border rounded-2xl border border-border bg-card px-3">
      {dsTruyen.map((truyen, i) => (
        <li key={truyen.slug}>
          <Link href={`/truyen/${truyen.slug}`} className="group flex items-center gap-3 py-2.5">
            <span
              className={`w-5 shrink-0 text-center text-lg font-bold ${
                i < 3 ? 'text-rank' : 'text-muted-foreground'
              }`}
            >
              {i + 1}
            </span>
            <BiaTruyen truyen={truyen} sizes="40px" className="w-10 shrink-0" anNhan />
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium group-hover:text-accent">{truyen.ten}</p>
              <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <BieuTuong ten="mat" className="h-3.5 w-3.5" />
                {dinhDangSoRutGon(truyen.luotXem ?? 0)} lượt xem
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// Kệ truyện vuốt ngang (mobile) / tràn hàng (desktop).
export function KeTruyen({
  dsMuc,
}: {
  dsMuc: { truyen: TruyenThe; href?: string; dong1: string; dong2?: string }[];
}) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
      {dsMuc.map(({ truyen, href, dong1, dong2 }) => (
        <Link
          key={truyen.slug}
          href={href ?? `/truyen/${truyen.slug}`}
          className="group w-28 shrink-0 snap-start sm:w-32"
        >
          <BiaTruyen truyen={truyen} sizes="128px" />
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:text-accent">
            {truyen.ten}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-accent">{dong1}</p>
          {dong2 && <p className="truncate text-xs text-muted-foreground">{dong2}</p>}
        </Link>
      ))}
    </div>
  );
}

export function DanhSachTheLoai({ dsTheLoai }: { dsTheLoai: { ten: string; slug: string; so: number }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {dsTheLoai.map((tl) => (
        <Link
          key={tl.slug}
          href={`/the-loai/${tl.slug}`}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
        >
          {tl.ten}
          <span className="ml-1 text-xs text-muted-foreground">{tl.so}</span>
        </Link>
      ))}
    </div>
  );
}
