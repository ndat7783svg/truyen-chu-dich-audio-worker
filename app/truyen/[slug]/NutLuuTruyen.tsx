'use client';

import { useState } from 'react';
import Link from 'next/link';
import { luuTruyen, boLuuTruyen } from './actions-luu';

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
    <div className="mt-3">
      <button
        onClick={bamNut}
        disabled={dangXuLy}
        aria-pressed={daLuu}
        title={daLuu ? 'Bỏ lưu truyện' : 'Lưu truyện'}
        className={
          daLuu
            ? 'p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
            : 'p-2 rounded-full border border-border hover:bg-surface disabled:opacity-60'
        }
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill={daLuu ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 3a1 1 0 00-1 1v16l7-4 7 4V4a1 1 0 00-1-1H6z"
          />
        </svg>
      </button>
      {hienThongBaoDangNhap && (
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href="/dang-nhap" className="underline">
            Đăng nhập
          </Link>{' '}
          để lưu truyện.
        </p>
      )}
    </div>
  );
}
