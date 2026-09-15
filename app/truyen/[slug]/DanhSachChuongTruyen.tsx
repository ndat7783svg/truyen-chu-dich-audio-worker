'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { taoDanhSachNhom, catChuongTheoNhom } from '@/lib/utils/chuong';

export type MucChuongTruyen = {
  id: string;
  so_chuong: number;
  tieu_de: string;
};

export default function DanhSachChuongTruyen({
  dsChuong,
  slugTruyen,
  coGoiHieuLuc,
}: {
  dsChuong: MucChuongTruyen[];
  slugTruyen: string;
  coGoiHieuLuc: boolean;
}) {
  const [soNhomDangChon, setSoNhomDangChon] = useState(0);

  const danhSachNhom = taoDanhSachNhom(dsChuong.length);
  const chuongHienThi = catChuongTheoNhom(dsChuong, soNhomDangChon);

  if (dsChuong.length === 0) {
    return <p className="mt-6 text-muted-foreground text-sm">Chưa có chương nào.</p>;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <h2 className="text-lg font-bold">Danh sách chương ({dsChuong.length})</h2>
      </div>

      {danhSachNhom.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 no-scrollbar">
          {danhSachNhom.map((nhom) => {
            const dangChon = nhom.soNhom === soNhomDangChon;
            return (
              <button
                key={nhom.soNhom}
                type="button"
                onClick={() => setSoNhomDangChon(nhom.soNhom)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  dangChon
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-surface border border-border text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Chương {nhom.nhan}
              </button>
            );
          })}
        </div>
      )}

      <ul className="mt-3 space-y-1">
        {chuongHienThi.map((chuong) => {
          const biKhoa = chuong.so_chuong > SO_CHUONG_FREE && !coGoiHieuLuc;
          return (
            <li key={chuong.id}>
              <Link
                href={`/truyen/${slugTruyen}/chuong/${chuong.so_chuong}`}
                className="flex items-center gap-1.5 hover:underline py-0.5 text-sm"
              >
                {biKhoa && (
                  <svg
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
                    />
                  </svg>
                )}
                <span>
                  Chương {chuong.so_chuong}: {chuong.tieu_de}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
