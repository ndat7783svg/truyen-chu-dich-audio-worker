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
}: {
  tenTruyen: string;
  slugTruyen: string;
  soChuong: number;
  tieuDe: string;
  noiDung: string;
  soChuongTruoc?: number;
  soChuongSau?: number;
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
      className="w-full max-w-2xl mx-auto p-4 relative"
      style={{
        backgroundColor: mauSac.nen,
        color: mauSac.chu,
        fontFamily: caiDat.phong === 'co-dien' ? notoSerif.style.fontFamily : undefined,
      }}
    >
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
      <nav className="mt-6 flex justify-between">
        {soChuongTruoc ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${soChuongTruoc}`}
            className="hover:underline"
          >
            ← Chương trước
          </Link>
        ) : (
          <span />
        )}
        {soChuongSau ? (
          <Link href={`/truyen/${slugTruyen}/chuong/${soChuongSau}`} className="hover:underline">
            Chương sau →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
