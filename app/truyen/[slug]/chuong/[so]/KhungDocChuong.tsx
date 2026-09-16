'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Noto_Serif } from 'next/font/google';
import {
  CAI_DAT_MAC_DINH,
  docCaiDatDoc,
  ghiCaiDatDoc,
  mauSacTheo,
  type CaiDatDoc,
} from '@/lib/utils/cai-dat-doc';
import { luuTienDoDoc, ghiLuotXemChuong } from './actions';
import PanelCaiDatDoc from './PanelCaiDatDoc';
import PanelDocAudio from './PanelDocAudio';
import DanhSachChuong, { type MucChuong } from './DanhSachChuong';

const notoSerif = Noto_Serif({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '700'],
});

export type ThongTinChuongMoi = {
  chuongId: string;
  soChuong: number;
  tieuDe: string;
  noiDung: string;
  audioUrl?: string | null;
  soChuongTruoc?: number;
  soChuongSau?: number;
  chuongIdSau?: string;
};

export default function KhungDocChuong({
  chuongId,
  tenTruyen,
  slugTruyen,
  truyenId,
  soChuong,
  tieuDe,
  noiDung,
  audioUrl,
  soChuongTruoc,
  soChuongSau,
  chuongIdSau,
  tongSoChuong,
  soNhomBanDau,
  dsChuongBanDau,
}: {
  chuongId: string;
  tenTruyen: string;
  slugTruyen: string;
  truyenId: string;
  soChuong: number;
  tieuDe: string;
  noiDung: string;
  audioUrl?: string | null;
  soChuongTruoc?: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tongSoChuong: number;
  soNhomBanDau: number;
  dsChuongBanDau: MucChuong[];
}) {
  const [caiDat, setCaiDat] = useState<CaiDatDoc>(CAI_DAT_MAC_DINH);
  const [hienThanhTop, setHienThanhTop] = useState(true);
  const scrollYTruocRef = useRef(0);

  // State quản lý chương đang hiển thị (cho phép chuyển chương liền mạch không reload trang)
  const [chuongHienTai, setChuongHienTai] = useState<ThongTinChuongMoi>({
    chuongId,
    soChuong,
    tieuDe,
    noiDung,
    audioUrl,
    soChuongTruoc,
    soChuongSau,
    chuongIdSau,
  });

  // Đồng bộ state khi props từ server thay đổi (ví dụ người dùng bấm link hoặc load trang mới)
  useEffect(() => {
    setChuongHienTai({
      chuongId,
      soChuong,
      tieuDe,
      noiDung,
      audioUrl,
      soChuongTruoc,
      soChuongSau,
      chuongIdSau,
    });
  }, [chuongId, soChuong, tieuDe, noiDung, audioUrl, soChuongTruoc, soChuongSau, chuongIdSau]);

  useEffect(() => {
    setCaiDat(docCaiDatDoc());
  }, []);

  useEffect(() => {
    function xuLyCuon() {
      const scrollY = window.scrollY;
      const truoc = scrollYTruocRef.current;
      if (scrollY > truoc && scrollY > 80) {
        setHienThanhTop(false);
      } else if (scrollY < truoc) {
        setHienThanhTop(true);
      }
      scrollYTruocRef.current = scrollY;
    }
    window.addEventListener('scroll', xuLyCuon, { passive: true });
    return () => window.removeEventListener('scroll', xuLyCuon);
  }, []);

  function capNhatCaiDat(caiDatMoi: CaiDatDoc) {
    setCaiDat(caiDatMoi);
    ghiCaiDatDoc(caiDatMoi);
  }

  // Callback chuyển chương tại chỗ phía client
  function xuLyChuyenChuongMoi(thongTinMoi: ThongTinChuongMoi) {
    setChuongHienTai(thongTinMoi);

    // Cập nhật URL trình duyệt mà không trigger Next.js router/RSC remount
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/truyen/${slugTruyen}/chuong/${thongTinMoi.soChuong}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Chạy các side-effect ngầm
    luuTienDoDoc(truyenId, thongTinMoi.chuongId);
    ghiLuotXemChuong(truyenId, thongTinMoi.chuongId);
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
      <div
        className={`fixed top-0 inset-x-0 z-40 h-14 transition-transform duration-300 ${
          hienThanhTop ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <Link
          href="/"
          aria-label="Về trang chủ"
          className="absolute top-3 left-3 w-9 h-9 rounded-full border flex items-center justify-center bg-white/80 text-gray-900"
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
          truyenId={truyenId}
          soChuongHienTai={chuongHienTai.soChuong}
          tongSoChuong={tongSoChuong}
          soNhomBanDau={soNhomBanDau}
          dsChuongBanDau={dsChuongBanDau}
        />
        <PanelDocAudio
          chuongId={chuongHienTai.chuongId}
          slugTruyen={slugTruyen}
          tenTruyen={tenTruyen}
          truyenId={truyenId}
          soChuong={chuongHienTai.soChuong}
          soChuongSau={chuongHienTai.soChuongSau}
          chuongIdSau={chuongHienTai.chuongIdSau}
          tieuDe={chuongHienTai.tieuDe}
          noiDung={chuongHienTai.noiDung}
          audioUrl={chuongHienTai.audioUrl}
          onChuyenChuongMoi={xuLyChuyenChuongMoi}
        />
        <PanelCaiDatDoc caiDat={caiDat} onDoiCaiDat={capNhatCaiDat} />
      </div>
      <p className="text-sm opacity-70">
        <Link href={`/truyen/${slugTruyen}`} className="hover:underline">
          {tenTruyen}
        </Link>
      </p>
      <h1 className="text-xl font-bold mt-1">
        Chương {chuongHienTai.soChuong}: {chuongHienTai.tieuDe}
      </h1>
      <article
        className="mt-4 whitespace-pre-line select-none"
        style={{ fontSize: `${caiDat.coChu}px`, lineHeight: caiDat.giaiDong }}
        onContextMenu={chanChuotPhai}
        onCopy={chanSaoChep}
        onCut={chanSaoChep}
      >
        {chuongHienTai.noiDung}
      </article>
      <nav className="mt-6 flex justify-between gap-3">
        {chuongHienTai.soChuongTruoc ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${chuongHienTai.soChuongTruoc}`}
            className="flex-1 min-h-11 flex items-center justify-center rounded-lg border border-border font-medium hover:bg-black/5"
          >
            ← Chương trước
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {chuongHienTai.soChuongSau ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${chuongHienTai.soChuongSau}`}
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

