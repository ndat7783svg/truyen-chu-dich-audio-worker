'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type MucChuong = { soChuong: number; tieuDe: string };

export default function DanhSachChuong({
  slugTruyen,
  soChuongHienTai,
  dsChuong,
}: {
  slugTruyen: string;
  soChuongHienTai: number;
  dsChuong: MucChuong[];
}) {
  const [moDanhSach, setMoDanhSach] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moDanhSach) return;

    function xuLyClickNgoai(suKien: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(suKien.target as Node)) {
        setMoDanhSach(false);
      }
    }

    document.addEventListener('mousedown', xuLyClickNgoai);
    return () => {
      document.removeEventListener('mousedown', xuLyClickNgoai);
    };
  }, [moDanhSach]);

  return (
    <div ref={boxRef} className="fixed top-3 left-14 z-40">
      <button
        type="button"
        onClick={() => setMoDanhSach((truoc) => !truoc)}
        aria-label="Danh sách chương"
        className="h-9 px-3 rounded-full border flex items-center justify-center text-xs font-semibold bg-white/80 text-gray-900"
      >
        Danh sách
      </button>
      {moDanhSach && (
        <div className="absolute left-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-lg border bg-white text-gray-900 shadow-lg z-40">
          {dsChuong.map((muc) => (
            <Link
              key={muc.soChuong}
              href={`/truyen/${slugTruyen}/chuong/${muc.soChuong}`}
              onClick={() => setMoDanhSach(false)}
              className={`block px-3 py-2 text-sm hover:bg-gray-100 ${
                muc.soChuong === soChuongHienTai ? 'font-bold text-blue-600' : ''
              }`}
            >
              Chương {muc.soChuong}: {muc.tieuDe}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
