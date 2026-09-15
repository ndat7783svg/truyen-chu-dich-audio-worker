'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { layNhomChuong, type MucChuong } from '@/lib/actions/lay-nhom-chuong';
import { taoDanhSachNhom } from '@/lib/utils/chuong';

export type { MucChuong };

export default function DanhSachChuong({
  slugTruyen,
  truyenId,
  soChuongHienTai,
  tongSoChuong,
  soNhomBanDau,
  dsChuongBanDau,
}: {
  slugTruyen: string;
  truyenId: string;
  soChuongHienTai: number;
  tongSoChuong: number;
  soNhomBanDau: number;
  dsChuongBanDau: MucChuong[];
}) {
  const [prevNhomBanDau, setPrevNhomBanDau] = useState(soNhomBanDau);
  const [moDanhSach, setMoDanhSach] = useState(false);
  const [soNhomDangChon, setSoNhomDangChon] = useState(soNhomBanDau);
  const [cacheNhom, setCacheNhom] = useState<Record<number, MucChuong[]>>({
    [soNhomBanDau]: dsChuongBanDau,
  });
  const [dangTai, setDangTai] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  if (prevNhomBanDau !== soNhomBanDau) {
    setPrevNhomBanDau(soNhomBanDau);
    setSoNhomDangChon(soNhomBanDau);
    setCacheNhom((prev) => ({
      ...prev,
      [soNhomBanDau]: dsChuongBanDau,
    }));
  }

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

  async function chonNhom(nhomMoi: number) {
    if (nhomMoi === soNhomDangChon) return;
    setSoNhomDangChon(nhomMoi);

    if (cacheNhom[nhomMoi]) return;

    setDangTai(true);
    try {
      const duLieu = await layNhomChuong(truyenId, nhomMoi);
      setCacheNhom((prev) => ({ ...prev, [nhomMoi]: duLieu }));
    } catch (err) {
      console.error('Lỗi khi tải nhóm chương:', err);
    } finally {
      setDangTai(false);
    }
  }

  const danhSachNhom = taoDanhSachNhom(tongSoChuong);
  const dsChuongHienTai = cacheNhom[soNhomDangChon] ?? [];

  return (
    <div ref={boxRef} className="absolute top-3 left-14 z-40">
      <button
        type="button"
        onClick={() => setMoDanhSach((truoc) => !truoc)}
        aria-label="Danh sách chương"
        className="h-9 px-3 rounded-full border flex items-center justify-center text-xs font-semibold bg-white/80 text-gray-900"
      >
        Danh sách
      </button>
      {moDanhSach && (
        <div className="absolute left-0 mt-2 w-72 max-h-96 rounded-lg border bg-white text-gray-900 shadow-lg z-40 flex flex-col overflow-hidden">
          {danhSachNhom.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto p-2 border-b bg-gray-50 shrink-0">
              {danhSachNhom.map((nhom) => {
                const dangChon = nhom.soNhom === soNhomDangChon;
                return (
                  <button
                    key={nhom.soNhom}
                    type="button"
                    onClick={() => chonNhom(nhom.soNhom)}
                    className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                      dangChon
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {nhom.nhan}
                  </button>
                );
              })}
            </div>
          )}

          <div className="overflow-y-auto flex-1 max-h-80">
            {dangTai ? (
              <div className="py-8 text-center text-xs text-gray-500">Đang tải chương...</div>
            ) : dsChuongHienTai.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">Không có chương nào.</div>
            ) : (
              dsChuongHienTai.map((muc) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
