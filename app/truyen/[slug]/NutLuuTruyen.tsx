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
  const [hienThongBaoDangNhap, setHienThongBaoDangNhap] = useState(false);

  async function bamNut() {
    if (!daDangNhap) {
      setHienThongBaoDangNhap(true);
      return;
    }
    const trangThaiMoi = !daLuu;
    setDaLuu(trangThaiMoi);
    const ketQua = trangThaiMoi ? await luuTruyen(truyenId) : await boLuuTruyen(truyenId);
    if (!ketQua.thanhCong) {
      setDaLuu(!trangThaiMoi);
      if (ketQua.canDangNhap) setHienThongBaoDangNhap(true);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={bamNut}
        className={
          daLuu
            ? 'px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium'
            : 'px-4 py-2 rounded border border-border text-sm font-medium'
        }
      >
        {daLuu ? 'Đã lưu' : '+ Lưu truyện'}
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
