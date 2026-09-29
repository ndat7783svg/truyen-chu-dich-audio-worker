'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { taoDanhSachNhom, catChuongTheoNhom, KICH_THUOC_NHOM_CHUONG } from '@/lib/utils/chuong';
import BieuTuong from '@/components/BieuTuong';

export type MucChuongTruyen = {
  id: string;
  so_chuong: number;
  tieu_de: string;
};

export default function DanhSachChuongTruyen({
  dsChuong,
  slugTruyen,
  coGoiHieuLuc,
  soChuongDangDoc,
}: {
  dsChuong: MucChuongTruyen[];
  slugTruyen: string;
  coGoiHieuLuc: boolean;
  soChuongDangDoc?: number;
}) {
  // Mở sẵn nhóm chứa chương đang đọc dở (nếu có), để khỏi phải tự tìm.
  const [soNhomDangChon, setSoNhomDangChon] = useState(() => {
    if (!soChuongDangDoc) return 0;
    const viTri = dsChuong.findIndex((c) => c.so_chuong === soChuongDangDoc);
    return viTri < 0 ? 0 : Math.floor(viTri / KICH_THUOC_NHOM_CHUONG);
  });

  const danhSachNhom = taoDanhSachNhom(dsChuong.length);
  const chuongHienThi = catChuongTheoNhom(dsChuong, soNhomDangChon);

  if (dsChuong.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Chưa có chương nào.</p>;
  }

  return (
    <div className="py-3">
      {danhSachNhom.length > 1 && (
        <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
          {danhSachNhom.map((nhom) => {
            const dangChon = nhom.soNhom === soNhomDangChon;
            return (
              <button
                key={nhom.soNhom}
                type="button"
                onClick={() => setSoNhomDangChon(nhom.soNhom)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                  dangChon
                    ? 'bg-accent font-semibold text-on-accent'
                    : 'border border-border bg-card hover:border-accent'
                }`}
              >
                {nhom.nhan}
              </button>
            );
          })}
        </div>
      )}

      <ul className="grid sm:grid-cols-2 sm:gap-x-6">
        {chuongHienThi.map((chuong) => {
          const biKhoa = chuong.so_chuong > SO_CHUONG_FREE && !coGoiHieuLuc;
          const dangDoc = chuong.so_chuong === soChuongDangDoc;
          return (
            <li key={chuong.id} className="border-b border-border">
              <Link
                href={`/truyen/${slugTruyen}/chuong/${chuong.so_chuong}`}
                prefetch={false}
                className={`flex items-center gap-2 py-2.5 text-sm hover:text-accent ${
                  dangDoc ? 'font-semibold text-accent' : ''
                }`}
              >
                <span className="w-16 shrink-0 text-muted-foreground">Ch. {chuong.so_chuong}</span>
                <span className="min-w-0 flex-1 truncate">{chuong.tieu_de}</span>
                {dangDoc && <span className="shrink-0 text-xs">Đang đọc</span>}
                {biKhoa && (
                  <BieuTuong ten="khoa" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
