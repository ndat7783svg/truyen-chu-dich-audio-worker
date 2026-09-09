import Link from 'next/link';
import Image from 'next/image';

export type TruyenThe = {
  slug: string;
  ten: string;
  tacGia: string | null;
  anhBia: string | null;
  trangThai: string;
  theLoai: { ten: string; slug: string }[];
};

export default function TheTruyen({ truyen }: { truyen: TruyenThe }) {
  const theLoaiHienThi = truyen.theLoai.slice(0, 3);
  const soDu = truyen.theLoai.length - theLoaiHienThi.length;

  return (
    <Link
      href={`/truyen/${truyen.slug}`}
      className="block rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[2/3] bg-gray-200">
        {truyen.anhBia ? (
          <Image
            src={truyen.anhBia}
            alt={truyen.ten}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm px-2 text-center">
            Chưa có ảnh bìa
          </div>
        )}
        <span className="absolute top-1 left-1 px-2 py-0.5 rounded text-xs bg-black/60 text-white">
          {truyen.trangThai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
        </span>
      </div>
      <div className="p-2">
        <h3 className="font-medium line-clamp-2">{truyen.ten}</h3>
        {truyen.tacGia && <p className="text-sm text-gray-500 truncate">{truyen.tacGia}</p>}
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
            {soDu > 0 && <span className="text-xs px-1.5 py-0.5 text-gray-500">+{soDu}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
