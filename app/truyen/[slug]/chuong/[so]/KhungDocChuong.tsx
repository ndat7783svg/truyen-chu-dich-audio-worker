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
import BieuTuong from '@/components/BieuTuong';

const notoSerif = Noto_Serif({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '700'],
});

export type ThongTinChuongMoi = {
  chuongId: string;
  soChuong: number;
  tieuDe: string;
  noiDung: string;
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
  soChuongTruoc?: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tongSoChuong: number;
  soNhomBanDau: number;
  dsChuongBanDau: MucChuong[];
}) {
  const [caiDat, setCaiDat] = useState<CaiDatDoc>(CAI_DAT_MAC_DINH);
  const [hienThanhTop, setHienThanhTop] = useState(true);
  const [tienDoDoc, setTienDoDoc] = useState(0);
  const scrollYTruocRef = useRef(0);

  // State quản lý chương đang hiển thị (cho phép chuyển chương liền mạch không reload trang)
  const [chuongHienTai, setChuongHienTai] = useState<ThongTinChuongMoi>({
    chuongId,
    soChuong,
    tieuDe,
    noiDung,
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
      soChuongTruoc,
      soChuongSau,
      chuongIdSau,
    });
  }, [chuongId, soChuong, tieuDe, noiDung, soChuongTruoc, soChuongSau, chuongIdSau]);

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
      const conLai = document.documentElement.scrollHeight - window.innerHeight;
      setTienDoDoc(conLai > 0 ? Math.min(100, Math.round((scrollY / conLai) * 100)) : 100);
    }
    xuLyCuon();
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

  const vienMo = caiDat.mauNen === 'toi' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const urlChuong = (so: number) => `/truyen/${slugTruyen}/chuong/${so}`;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: mauSac.nen,
        color: mauSac.chu,
        fontFamily: caiDat.phong === 'co-dien' ? notoSerif.style.fontFamily : undefined,
      }}
    >
      {/* Thanh tiến độ đọc chương - luôn hiện, kể cả khi thanh công cụ đã ẩn */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.5" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${tienDoDoc}%` }} />
      </div>

      <div
        className={`fixed top-0 inset-x-0 z-40 h-14 border-b transition-transform duration-300 ${
          hienThanhTop ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ backgroundColor: mauSac.nen, borderColor: vienMo }}
      >
        <Link
          href="/"
          aria-label="Về trang chủ"
          className="absolute top-3 left-3 w-9 h-9 rounded-full border flex items-center justify-center bg-white/80 text-gray-900"
        >
          <BieuTuong ten="nha" />
        </Link>
        <p className="pointer-events-none absolute inset-x-48 top-0 hidden h-14 items-center justify-center text-xs opacity-70 sm:flex">
          <span className="truncate">
            {tenTruyen} · Chương {chuongHienTai.soChuong}
          </span>
        </p>
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
          soChuongTruoc={chuongHienTai.soChuongTruoc}
          soChuongSau={chuongHienTai.soChuongSau}
          chuongIdSau={chuongHienTai.chuongIdSau}
          tieuDe={chuongHienTai.tieuDe}
          noiDung={chuongHienTai.noiDung}
          onChuyenChuongMoi={xuLyChuyenChuongMoi}
        />
        <PanelCaiDatDoc caiDat={caiDat} onDoiCaiDat={capNhatCaiDat} />
      </div>

      <main className="relative mx-auto w-full max-w-2xl px-5 pb-28 pt-20">
        <Link href={`/truyen/${slugTruyen}`} className="text-sm opacity-70 hover:underline">
          {tenTruyen}
        </Link>
        <h1 className="mt-1 text-2xl font-bold leading-snug">
          Chương {chuongHienTai.soChuong}: {chuongHienTai.tieuDe}
        </h1>
        <article
          className="mt-6 whitespace-pre-line select-none"
          style={{ fontSize: `${caiDat.coChu}px`, lineHeight: caiDat.giaiDong }}
          onContextMenu={chanChuotPhai}
          onCopy={chanSaoChep}
          onCut={chanSaoChep}
        >
          {chuongHienTai.noiDung}
        </article>

        {/* Điều hướng cuối chương */}
        <nav className="mt-10 grid grid-cols-2 gap-3">
          {chuongHienTai.soChuongTruoc ? (
            <Link
              href={urlChuong(chuongHienTai.soChuongTruoc)}
              className="flex min-h-12 items-center justify-center gap-1 rounded-xl border font-semibold"
              style={{ borderColor: vienMo }}
            >
              <BieuTuong ten="trai" className="h-4 w-4" /> Chương trước
            </Link>
          ) : (
            <span />
          )}
          {chuongHienTai.soChuongSau ? (
            <Link
              href={urlChuong(chuongHienTai.soChuongSau)}
              className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-accent font-semibold text-on-accent"
            >
              Chương sau <BieuTuong ten="phai" className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/truyen/${slugTruyen}`}
              className="flex min-h-12 items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold"
              style={{ borderColor: vienMo }}
            >
              Hết chương đã đăng — về trang truyện
            </Link>
          )}
        </nav>
      </main>

      {/* Thanh điều hướng nhanh dưới đáy - hiện/ẩn cùng thanh trên */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${
          hienThanhTop ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ backgroundColor: mauSac.nen, borderColor: vienMo }}
      >
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-2">
          <NutDuoiDay href={chuongHienTai.soChuongTruoc ? urlChuong(chuongHienTai.soChuongTruoc) : null} vien={vienMo}>
            <BieuTuong ten="trai" className="h-4 w-4" /> Trước
          </NutDuoiDay>
          <Link
            href={`/truyen/${slugTruyen}#danh-sach-chuong`}
            aria-label="Danh sách chương"
            className="flex h-11 w-12 shrink-0 items-center justify-center rounded-xl border"
            style={{ borderColor: vienMo }}
          >
            <BieuTuong ten="danh-sach" />
          </Link>
          <NutDuoiDay
            href={chuongHienTai.soChuongSau ? urlChuong(chuongHienTai.soChuongSau) : null}
            vien={vienMo}
            nhan
          >
            Sau <BieuTuong ten="phai" className="h-4 w-4" />
          </NutDuoiDay>
        </div>
      </nav>
    </div>
  );
}

function NutDuoiDay({
  href,
  vien,
  nhan = false,
  children,
}: {
  href: string | null;
  vien: string;
  nhan?: boolean;
  children: React.ReactNode;
}) {
  const lop = 'flex h-11 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold';
  if (!href) {
    return (
      <span className={`${lop} border opacity-40`} style={{ borderColor: vien }} aria-disabled="true">
        {children}
      </span>
    );
  }
  return nhan ? (
    <Link href={href} className={`${lop} bg-accent text-on-accent`}>
      {children}
    </Link>
  ) : (
    <Link href={href} className={`${lop} border`} style={{ borderColor: vien }}>
      {children}
    </Link>
  );
}
