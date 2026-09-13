'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { boLuuTruyen } from '@/app/truyen/[slug]/actions-luu';

export default function DongTruyenDaLuu({
  truyenId,
  slug,
  ten,
  anhBia,
}: {
  truyenId: string;
  slug: string;
  ten: string;
  anhBia: string | null;
}) {
  const [daXoa, setDaXoa] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);

  async function boLuu() {
    if (dangXuLy) return;
    setDangXuLy(true);
    setDaXoa(true);
    const ketQua = await boLuuTruyen(truyenId);
    if (!ketQua.thanhCong) setDaXoa(false);
    setDangXuLy(false);
  }

  if (daXoa) return null;

  return (
    <li className="flex items-center gap-3 border border-border bg-surface rounded-lg p-2">
      <div className="relative w-10 aspect-[2/3] shrink-0 bg-background rounded overflow-hidden">
        {anhBia && (
          <Image src={anhBia} alt={ten} fill sizes="40px" className="object-cover" />
        )}
      </div>
      <Link href={`/truyen/${slug}`} className="flex-1 truncate hover:underline">
        {ten}
      </Link>
      <button
        onClick={boLuu}
        className="text-sm text-muted-foreground hover:underline shrink-0"
      >
        Bỏ lưu
      </button>
    </li>
  );
}
