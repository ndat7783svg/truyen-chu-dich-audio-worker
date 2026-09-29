import Link from 'next/link';
import Image from 'next/image';
import { dinhDangSoRutGon } from '@/lib/utils/format';
import BieuTuong from './BieuTuong';

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

// Ảnh bìa + nhãn dùng chung cho thẻ truyện dạng lưới và dạng kệ vuốt ngang.
export function BiaTruyen({
  truyen,
  sizes,
  className = '',
  anNhan = false,
}: {
  truyen: Pick<TruyenThe, 'ten' | 'anhBia' | 'trangThai'>;
  sizes: string;
  className?: string;
  anNhan?: boolean; // ảnh bìa nhỏ (bảng xếp hạng) không đủ chỗ cho nhãn
}) {
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-surface ring-1 ring-border ${className}`}
    >
      {truyen.anhBia ? (
        <Image
          src={truyen.anhBia}
          alt={truyen.ten}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
          {truyen.ten}
        </div>
      )}
      {!anNhan && truyen.trangThai === 'hoan-thanh' && (
        <span className="absolute left-1.5 top-1.5 rounded bg-done px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Full
        </span>
      )}
      {!anNhan && (
        <span className="absolute right-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">
          Dịch
        </span>
      )}
    </div>
  );
}

export default function TheTruyen({ truyen }: { truyen: TruyenThe }) {
  return (
    <Link href={`/truyen/${truyen.slug}`} className="group block min-w-0">
      <BiaTruyen truyen={truyen} sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 170px" />
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:text-accent">
        {truyen.ten}
      </h3>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {typeof truyen.soChuong === 'number' && <span>{truyen.soChuong} ch</span>}
        <span className="flex items-center gap-0.5">
          <BieuTuong ten="mat" className="h-3.5 w-3.5" />
          {dinhDangSoRutGon(truyen.luotXem ?? 0)}
        </span>
      </div>
    </Link>
  );
}
