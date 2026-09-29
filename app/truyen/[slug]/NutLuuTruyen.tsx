'use client';

import { useState } from 'react';
import Link from 'next/link';
import { luuTruyen, boLuuTruyen } from './actions-luu';
import BieuTuong from '@/components/BieuTuong';

export default function NutLuuTruyen({
  truyenId,
  daLuuBanDau,
  daDangNhap,
}: {
  truyenId: string;
  daLuuBanDau: boolean;
  daDangNhap: boolean;
}) {
  const [daLuu, setDaLuu] = useState(daLuuBanDau);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [hienThongBaoDangNhap, setHienThongBaoDangNhap] = useState(false);

  async function bamNut() {
    if (!daDangNhap) {
      setHienThongBaoDangNhap(true);
      return;
    }
    if (dangXuLy) return;

    setDangXuLy(true);
    const trangThaiMoi = !daLuu;
    setDaLuu(trangThaiMoi);
    const ketQua = trangThaiMoi ? await luuTruyen(truyenId) : await boLuuTruyen(truyenId);
    if (!ketQua.thanhCong) {
      setDaLuu(!trangThaiMoi);
      if (ketQua.canDangNhap) setHienThongBaoDangNhap(true);
    }
    setDangXuLy(false);
  }

  return (
    <div className="relative">
      <button
        onClick={bamNut}
        disabled={dangXuLy}
        aria-pressed={daLuu}
        aria-label={daLuu ? 'Bỏ lưu truyện' : 'Lưu truyện'}
        title={daLuu ? 'Bỏ lưu truyện' : 'Lưu truyện'}
        className={`flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold disabled:opacity-60 ${
          daLuu
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-border bg-card hover:border-accent'
        }`}
      >
        <BieuTuong ten="danh-dau" dac={daLuu} className="h-5 w-5" />
        <span>{daLuu ? 'Đã lưu' : 'Lưu'}</span>
      </button>
      {hienThongBaoDangNhap && (
        <p className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg border border-border bg-card p-2 text-xs text-muted-foreground shadow-md">
          <Link href="/dang-nhap" className="font-semibold text-accent underline">
            Đăng nhập
          </Link>{' '}
          để lưu truyện.
        </p>
      )}
    </div>
  );
}
