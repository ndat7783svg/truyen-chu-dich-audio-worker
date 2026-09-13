'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Noto_Serif } from 'next/font/google';
import {
  CAI_DAT_MAC_DINH,
  docCaiDatDoc,
  ghiCaiDatDoc,
  mauSacTheo,
  type CaiDatDoc,
} from '@/lib/utils/cai-dat-doc';
import PanelCaiDatDoc from './PanelCaiDatDoc';
import DanhSachChuong, { type MucChuong } from './DanhSachChuong';

const notoSerif = Noto_Serif({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '700'],
});

export default function KhungDocChuong({
  tenTruyen,
  slugTruyen,
  soChuong,
  tieuDe,
  noiDung,
  soChuongTruoc,
  soChuongSau,
  dsChuong,
}: {
  tenTruyen: string;
  slugTruyen: string;
  soChuong: number;
  tieuDe: string;
  noiDung: string;
  soChuongTruoc?: number;
  soChuongSau?: number;
  dsChuong: MucChuong[];
}) {
  const [caiDat, setCaiDat] = useState<CaiDatDoc>(CAI_DAT_MAC_DINH);

  useEffect(() => {
    setCaiDat(docCaiDatDoc());
  }, []);

  function capNhatCaiDat(caiDatMoi: CaiDatDoc) {
    setCaiDat(caiDatMoi);
    ghiCaiDatDoc(caiDatMoi);
  }

  const mauSac = mauSacTheo(caiDat.mauNen);

  function chanChuotPhai(e: React.MouseEvent) {
    e.preventDefault();
  }

  function chanSaoChep(e: React.ClipboardEvent) {
    e.preventDefault();
  }

  return (
    <main
      className="w-full max-w-2xl mx-auto p-4 pt-14 relative"
      style={{
        backgroundColor: mauSac.nen,
        color: mauSac.chu,
        fontFamily: caiDat.phong === 'co-dien' ? notoSerif.style.fontFamily : undefined,
      }}
    >
      <Link
        href="/"
        aria-label="Về trang chủ"
        className="fixed top-3 left-3 z-40 w-9 h-9 rounded-full border flex items-center justify-center bg-white/80 text-gray-900"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </Link>
      <DanhSachChuong
        slugTruyen={slugTruyen}
        soChuongHienTai={soChuong}
        dsChuong={dsChuong}
      />
      <PanelCaiDatDoc caiDat={caiDat} onDoiCaiDat={capNhatCaiDat} />
      <p className="text-sm opacity-70">
        <Link href={`/truyen/${slugTruyen}`} className="hover:underline">
          {tenTruyen}
        </Link>
      </p>
      <h1 className="text-xl font-bold mt-1">
        Chương {soChuong}: {tieuDe}
      </h1>
      <article
        className="mt-4 whitespace-pre-line select-none"
        style={{ fontSize: `${caiDat.coChu}px`, lineHeight: caiDat.giaiDong }}
        onContextMenu={chanChuotPhai}
        onCopy={chanSaoChep}
        onCut={chanSaoChep}
      >
        {noiDung}
      </article>
      <nav className="mt-6 flex justify-between gap-3">
        {soChuongTruoc ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${soChuongTruoc}`}
            className="flex-1 min-h-11 flex items-center justify-center rounded-lg border border-border font-medium hover:bg-black/5"
          >
            ← Chương trước
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {soChuongSau ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${soChuongSau}`}
            className="flex-1 min-h-11 flex items-center justify-center rounded-lg border border-border font-medium hover:bg-black/5"
          >
            Chương sau →
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </main>
  );
}
