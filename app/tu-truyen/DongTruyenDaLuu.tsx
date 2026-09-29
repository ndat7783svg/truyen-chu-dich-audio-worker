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
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
      <div className="relative w-12 aspect-[2/3] shrink-0 overflow-hidden rounded-lg bg-surface">
        {anhBia && (
          <Image src={anhBia} alt={ten} fill sizes="48px" className="object-cover" />
        )}
      </div>
      <Link href={`/truyen/${slug}`} className="min-w-0 flex-1 line-clamp-2 font-medium hover:text-accent">
        {ten}
      </Link>
      <button
        onClick={boLuu}
        className="shrink-0 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-surface"
      >
        Bỏ lưu
      </button>
    </li>
  );
}
