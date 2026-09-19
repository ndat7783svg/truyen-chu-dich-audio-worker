/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type HlsType from 'hls.js';
import { taoSupabaseClient } from '@/lib/supabase/client';
import { GIOI_HAN_TOC_DO, docCaiDatAudio, ghiCaiDatAudio } from '@/lib/utils/cai-dat-audio';
import { nenDungHlsGoc } from '@/lib/audio/nhan-dien-trinh-duyet';
import type { ThongTinChuongMoi } from './KhungDocChuong';

type MucChuong = {
  chuongId: string;
  soChuong: number;
  tieuDe: string;
  batDauGiay: number;
  thoiLuongGiay: number;
  soDoan: number;
  doanBatDau: number;
  soChuongSau?: number;
  chuongIdSau?: string;
};

type Manifest = {
  playlistUrl: string;
  chuongs: MucChuong[];
  dungLai: { soChuong: number; lyDo: 'chua_dang_nhap' | 'can_vip' } | null;
  chuongSauCuoi: { chuongId: string; soChuong: number } | null;
};

type TrangThai =
  | { loai: 'nghi' }
  | { loai: 'dangTai' }
  | { loai: 'phat' }
  | { loai: 'vip'; soChuong: number; lyDo: 'chua_dang_nhap' | 'can_vip' }
  | { loai: 'loi'; thongBao: string };

function dinhDangThoiGian(giay: number): string {
  if (!Number.isFinite(giay) || giay < 0) return '00:00';
  const phut = Math.floor(giay / 60);
  const s = Math.floor(giay % 60);
  return `${String(phut).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ModalNgheAudioHls({
  moModal,
  onDong,
  chuongId,
  slugTruyen,
  tenTruyen,
  truyenId,
  soChuong,
  soChuongTruoc,
  soChuongSau,
  tieuDe,
  onDungWebSpeech,
  tuDongPhatNgay,
  onChuyenChuongMoi,
}: {
  moModal: boolean;
  onDong: () => void;
  chuongId: string;
  slugTruyen: string;
  tenTruyen: string;
  truyenId: string;
  soChuong: number;
  soChuongTruoc?: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tieuDe: string;
  onDungWebSpeech?: () => void;
  tuDongPhatNgay?: boolean;
  onChuyenChuongMoi?: (thongTinMoi: ThongTinChuongMoi) => void;
}) {
  const [daMount, setDaMount] = useState(false);
  const [trangThai, setTrangThai] = useState<TrangThai>({ loai: 'nghi' });
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [chiSoChuong, setChiSoChuong] = useState(0);
  const [dangPhat, setDangPhat] = useState(false);
  const [thoiGian, setThoiGian] = useState(0); // currentTime toàn playlist
  const [tocDo, setTocDo] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const chiSoRef = useRef(0);
  const dungHlsGocRef = useRef(false);
  const tocDoRef = useRef(1);
  const soLanThuLaiMangRef = useRef(0);
  const daTuDongPhatRef = useRef(false);
  // chương mà UI đang hiển thị do CHÍNH modal này điều khiển; effect theo `chuongId` dùng để phân biệt
  // "modal tự đổi chương" (bỏ qua) với "người dùng bấm sang chương khác" (dừng audio).
  const chuongDangHienThiRef = useRef(chuongId);
  const soChuongTruocGocRef = useRef<number | undefined>(soChuongTruoc);

  useEffect(() => {
    setDaMount(true);
    const daLuu = docCaiDatAudio();
    setTocDo(daLuu.tocDo);
    tocDoRef.current = daLuu.tocDo;
    dungHlsGocRef.current = nenDungHlsGoc(navigator.userAgent);
    return () => dungNguon();
  }, []);

  function dungNguon() {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }

  function dungHoanToan() {
    dungNguon();
    manifestRef.current = null;
    setManifest(null);
    setDangPhat(false);
    setThoiGian(0);
    setTrangThai({ loai: 'nghi' });
  }

  // Người dùng tự bấm sang chương khác (không phải do modal tự đổi) -> dừng audio đang phát.
  useEffect(() => {
    if (chuongId === chuongDangHienThiRef.current) return;
    chuongDangHienThiRef.current = chuongId;
    dungHoanToan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chuongId]);

  function capNhatMediaSession(muc: MucChuong) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Chương ${muc.soChuong}: ${muc.tieuDe}`,
      artist: tenTruyen,
      album: tenTruyen,
    });
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => tuaGiay(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => tuaGiay(10));
    navigator.mediaSession.setActionHandler('nexttrack', () => nhayChuong(chiSoRef.current + 1));
  }

  // Đổi chữ hiển thị sang chương `chiSo` của playlist (audio vẫn chạy liên tục, chỉ đồng bộ giao diện).
  async function hienThiChuong(chiSo: number, ep = false) {
    const man = manifestRef.current;
    if (!man || chiSo < 0 || chiSo >= man.chuongs.length) return;
    if (chiSo === chiSoRef.current && !ep) return;
    chiSoRef.current = chiSo;
    setChiSoChuong(chiSo);
    const muc = man.chuongs[chiSo];
    capNhatMediaSession(muc);
    chuongDangHienThiRef.current = muc.chuongId;

    const { data: noiDung, error } = await taoSupabaseClient().rpc('lay_noi_dung_chuong', {
      p_chuong_id: muc.chuongId,
    });
    if (chiSoRef.current !== chiSo) return; // trong lúc chờ đã sang chương khác
    if (error || noiDung == null) return; // audio vẫn phát; chữ sẽ đồng bộ ở lần đổi chương sau
    onChuyenChuongMoi?.({
      chuongId: muc.chuongId,
      soChuong: muc.soChuong,
      tieuDe: muc.tieuDe,
      noiDung,
      soChuongTruoc: chiSo > 0 ? man.chuongs[chiSo - 1].soChuong : soChuongTruocGocRef.current,
      soChuongSau: muc.soChuongSau,
      chuongIdSau: muc.chuongIdSau,
    });
  }

  function chiSoTheoDoan(sn: number): number {
    const man = manifestRef.current;
    if (!man) return 0;
    for (let i = man.chuongs.length - 1; i >= 0; i -= 1) {
      if (sn >= man.chuongs[i].doanBatDau) return i;
    }
    return 0;
  }

  function chiSoTheoThoiGian(giay: number): number {
    const man = manifestRef.current;
    if (!man) return 0;
    for (let i = man.chuongs.length - 1; i >= 0; i -= 1) {
      if (giay >= man.chuongs[i].batDauGiay) return i;
    }
    return 0;
  }

  function tuaGiay(delta: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime + delta);
  }

  function nhayChuong(chiSo: number) {
    const man = manifestRef.current;
    const el = audioRef.current;
    if (!man || !el || chiSo < 0 || chiSo >= man.chuongs.length) return;
    el.currentTime = man.chuongs[chiSo].batDauGiay;
  }

  async function taiManifest(soChuongBatDau: number): Promise<Manifest | null> {
    try {
      const res = await fetch(`/api/audio/manifest?t=${truyenId}&c=${soChuongBatDau}`);
      if (res.status === 403) {
        const j = await res.json();
        dungNguon();
        setTrangThai({ loai: 'vip', soChuong: j.soChuong ?? soChuongBatDau, lyDo: j.lyDo });
        return null;
      }
      if (res.status === 429) {
        dungNguon();
        setTrangThai({ loai: 'loi', thongBao: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' });
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Manifest;
    } catch {
      dungNguon();
      setTrangThai({ loai: 'loi', thongBao: 'Không tải được danh sách phát. Kiểm tra mạng rồi bấm Thử lại.' });
      return null;
    }
  }

  // Bắt đầu phát từ chương `soChuongBatDau`. PHẢI gọi trực tiếp từ sự kiện bấm nút (xem ghi chú iPhone).
  function batDauPhat(soChuongBatDau: number, laTiepNoi = false) {
    const el = audioRef.current;
    if (!el) return;
    onDungWebSpeech?.();
    dungNguon();
    // Bỏ manifest cũ NGAY: nếu không, sự kiện FRAG_CHANGED của playlist mới (sn=0) sẽ bị map theo manifest
    // cũ và kéo giao diện về chương đầu của danh sách cũ (lỗi khi nạp tiếp playlist sau 11 chương).
    manifestRef.current = null;
    setManifest(null);
    setTrangThai({ loai: 'dangTai' });
    setThoiGian(0);
    soLanThuLaiMangRef.current = 0;
    if (!laTiepNoi) soChuongTruocGocRef.current = soChuongTruoc;

    const playlistUrl = `/api/audio/playlist.m3u8?t=${truyenId}&c=${soChuongBatDau}`;
    el.defaultPlaybackRate = tocDoRef.current;
    el.playbackRate = tocDoRef.current;

    if (dungHlsGocRef.current) {
      el.src = playlistUrl; // đồng bộ trong thao tác bấm -> iPhone cho phép play()
      el.play().catch(() => {});
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          el.src = playlistUrl;
          el.play().catch(() => {});
          return;
        }
        const hls = new Hls();
        hlsRef.current = hls;
        hls.on(Hls.Events.FRAG_CHANGED, (_e, d) => {
          const sn = typeof d.frag.sn === 'number' ? d.frag.sn : 0;
          hienThiChuong(chiSoTheoDoan(sn));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          const maHttp = data.response?.code;
          if (maHttp === 503) {
            dungNguon();
            setTrangThai({ loai: 'loi', thongBao: 'Hệ thống đang đông, vui lòng thử lại sau ít phút.' });
          } else if (maHttp === 403) {
            dungNguon();
            setTrangThai({ loai: 'vip', soChuong: soChuongBatDau, lyDo: 'can_vip' });
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && soLanThuLaiMangRef.current < 3) {
            soLanThuLaiMangRef.current += 1;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && soLanThuLaiMangRef.current < 3) {
            soLanThuLaiMangRef.current += 1;
            hls.recoverMediaError();
          } else {
            dungNguon();
            setTrangThai({ loai: 'loi', thongBao: 'Không tạo được audio cho đoạn này. Bấm Thử lại.' });
          }
        });
        hls.loadSource(playlistUrl);
        hls.attachMedia(el);
        el.play().catch(() => {});
      });
    }

    // Manifest chỉ để dựng giao diện/mốc chương; tải song song, không chặn việc phát.
    taiManifest(soChuongBatDau).then((man) => {
      if (!man) return;
      manifestRef.current = man;
      setManifest(man);
      chiSoRef.current = 0;
      setChiSoChuong(0);
      setTrangThai({ loai: 'phat' });
      if (laTiepNoi) hienThiChuong(0, true);
      else capNhatMediaSession(man.chuongs[0]);
    });
  }

  // Tự phát khi vừa được điều hướng sang chương theo cờ tuDongPhatNgay (giữ hành vi của modal cũ).
  useEffect(() => {
    if (tuDongPhatNgay && daMount && !daTuDongPhatRef.current) {
      daTuDongPhatRef.current = true;
      batDauPhat(soChuong);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuDongPhatNgay, daMount]);

  function khiKetThuc() {
    setDangPhat(false);
    const man = manifestRef.current;
    if (!man) return;
    if (man.dungLai) {
      setTrangThai({ loai: 'vip', soChuong: man.dungLai.soChuong, lyDo: man.dungLai.lyDo });
      return;
    }
    // Hết 11 chương của playlist: nạp playlist mới từ chương kế (cần trang còn hoạt động).
    if (man.chuongSauCuoi) batDauPhat(man.chuongSauCuoi.soChuong, true);
  }

  function togglePhat() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function doiTocDo(moi: number) {
    setTocDo(moi);
    tocDoRef.current = moi;
    ghiCaiDatAudio({ tocDo: moi });
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = moi;
      audioRef.current.playbackRate = moi;
    }
  }

  const muc = manifest?.chuongs[chiSoChuong] ?? null;
  const thoiGianTrongChuong = muc ? Math.max(0, Math.min(muc.thoiLuongGiay, thoiGian - muc.batDauGiay)) : 0;

  const phanTuAudio = daMount
    ? createPortal(
        <audio
          ref={audioRef}
          preload="auto"
          onPlay={() => setDangPhat(true)}
          onPause={() => setDangPhat(false)}
          onEnded={khiKetThuc}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (!el) return;
            setThoiGian(el.currentTime);
            // Safari (HLS gốc) không có sự kiện đổi đoạn -> suy ra chương từ mốc thời gian ước lượng.
            if (dungHlsGocRef.current) hienThiChuong(chiSoTheoThoiGian(el.currentTime));
          }}
          className="hidden"
        />,
        document.body
      )
    : null;

  if (!moModal || !daMount) return phanTuAudio;

  const dangChay = trangThai.loai === 'phat' || trangThai.loai === 'dangTai';

  return (
    <>
      {phanTuAudio}
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-100 p-5 space-y-5 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-blue-600 truncate">{tenTruyen}</p>
                <h3 className="text-base font-bold text-gray-900 truncate">
                  Chương {muc?.soChuong ?? soChuong}: {muc?.tieuDe ?? tieuDe}
                </h3>
              </div>
              <button
                type="button"
                onClick={onDong}
                aria-label="Đóng"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {trangThai.loai === 'vip' && (
              <div className="py-4 text-center space-y-4">
                <h4 className="font-bold text-gray-900 text-base">Chương {trangThai.soChuong} cần gói VIP</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                  50 chương đầu đọc và nghe miễn phí. Từ chương {trangThai.soChuong} trở đi, vui lòng{' '}
                  {trangThai.lyDo === 'chua_dang_nhap' ? 'đăng nhập và ' : ''}nâng cấp gói VIP để tiếp tục.
                </p>
                <Link
                  href={`/truyen/${slugTruyen}/chuong/${trangThai.soChuong}`}
                  onClick={onDong}
                  className="block w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm shadow-md"
                >
                  💎 Nâng cấp gói VIP để nghe tiếp
                </Link>
              </div>
            )}

            {trangThai.loai === 'loi' && (
              <div className="py-4 text-center space-y-4">
                <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl">{trangThai.thongBao}</p>
                <button
                  type="button"
                  onClick={() => batDauPhat(muc?.soChuong ?? soChuong)}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md"
                >
                  Thử lại
                </button>
              </div>
            )}

            {trangThai.loai === 'nghi' && (
              <div className="py-4 text-center space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Audio giọng đọc Neural (Hoài My)</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Bấm bắt đầu để nghe ngay, tự chuyển sang các chương sau, tắt màn hình vẫn nghe được.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => batDauPhat(soChuong)}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Bắt đầu
                </button>
              </div>
            )}

            {dangChay && (
              <div className="space-y-5 py-2">
                {trangThai.loai === 'dangTai' && !muc && (
                  <p className="text-center text-sm text-blue-600 font-medium">Đang chuẩn bị audio...</p>
                )}
                <div className="space-y-1.5">
                  <input
                    type="range"
                    min={0}
                    max={muc?.thoiLuongGiay ?? 100}
                    step={0.5}
                    value={thoiGianTrongChuong}
                    disabled={!muc}
                    onChange={(e) => {
                      if (muc && audioRef.current) audioRef.current.currentTime = muc.batDauGiay + Number(e.target.value);
                    }}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>{dinhDangThoiGian(thoiGianTrongChuong)}</span>
                    <span>~{dinhDangThoiGian(muc?.thoiLuongGiay ?? 0)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button type="button" onClick={() => tuaGiay(-10)} aria-label="Tua lùi 10 giây" className="text-gray-600 hover:text-blue-600 text-xs font-semibold">
                    « 10s
                  </button>
                  <button
                    type="button"
                    onClick={togglePhat}
                    aria-label={dangPhat ? 'Tạm dừng' : 'Phát'}
                    className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg active:scale-95"
                  >
                    {dangPhat ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                    ) : (
                      <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                  <button type="button" onClick={() => tuaGiay(10)} aria-label="Tua tiến 10 giây" className="text-gray-600 hover:text-blue-600 text-xs font-semibold">
                    10s »
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-gray-600 uppercase">Tốc độ đọc</span>
                    <span className="font-bold text-blue-600 font-mono">{tocDo.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={GIOI_HAN_TOC_DO.min}
                    max={GIOI_HAN_TOC_DO.max}
                    step={0.25}
                    value={tocDo}
                    onChange={(e) => doiTocDo(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {(muc?.soChuongSau ?? soChuongSau) && (
                  <p className="text-[11px] text-gray-400 text-center">
                    Đọc xong sẽ tự động chuyển sang chương sau.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
