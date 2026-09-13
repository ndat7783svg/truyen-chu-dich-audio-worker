import Link from 'next/link';
import Image from 'next/image';
import { dinhDangSoRutGon } from '@/lib/utils/format';

export type TruyenThe = {
  slug: string;
  ten: string;
  tacGia: string | null;
  anhBia: string | null;
  trangThai: string;
  theLoai: { ten: string; slug: string }[];
  luotXem?: number;
  soChuong?: number;
};

export default function TheTruyen({ truyen }: { truyen: TruyenThe }) {
  const theLoaiHienThi = truyen.theLoai.slice(0, 3);
  const soDu = truyen.theLoai.length - theLoaiHienThi.length;

  return (
    <Link
      href={`/truyen/${truyen.slug}`}
      className="block rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[2/3] bg-surface">
        {truyen.anhBia ? (
          <Image
            src={truyen.anhBia}
            alt={truyen.ten}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm px-2 text-center">
            Chưa có ảnh bìa
          </div>
        )}
        <span className="absolute top-1 left-1 px-2 py-0.5 rounded text-xs bg-black/60 text-white">
          {truyen.trangThai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
        </span>
        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-600 text-white">
          AI
        </span>
      </div>
      <div className="p-2">
        <h3 className="font-medium line-clamp-2">{truyen.ten}</h3>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
          {truyen.tacGia ? (
            <p className="truncate flex-1 pr-1">{truyen.tacGia}</p>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            {dinhDangSoRutGon(truyen.luotXem ?? 0)}
          </span>
        </div>
        {typeof truyen.soChuong === 'number' && (
          <p className="text-xs text-muted-foreground mt-0.5">{truyen.soChuong} chương</p>
        )}
        {theLoaiHienThi.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {theLoaiHienThi.map((tl) => (
              <span
                key={tl.slug}
                className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
              >
                {tl.ten}
              </span>
            ))}
            {soDu > 0 && <span className="text-xs px-1.5 py-0.5 text-muted-foreground">+{soDu}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
