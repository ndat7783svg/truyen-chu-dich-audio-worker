'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';
import {
  GIOI_HAN_TOC_DO,
  docCaiDatAudio,
  ghiCaiDatAudio,
} from '@/lib/utils/cai-dat-audio';
import { yeuCauTaoAudioNgay } from './actions-audio';

const KHOA_TU_DONG_DOC = 'chuongTuDongDocTiep';
const KHOA_MO_MODAL_AUDIO_THAT = 'moModalAudioThat';

function dinhDangThoiGian(giay: number): string {
  if (isNaN(giay) || giay < 0) return '00:00';
  const phut = Math.floor(giay / 60);
  const giayDu = Math.floor(giay % 60);
  return `${String(phut).padStart(2, '0')}:${String(giayDu).padStart(2, '0')}`;
}

export default function ModalNgheAudioThat({
  moModal,
  onDong,
  chuongId,
  audioUrl,
  slugTruyen,
  tenTruyen,
  soChuong,
  soChuongSau,
  chuongIdSau,
  tieuDe,
  onDungWebSpeech,
  tuDongPhatNgay,
}: {
  moModal: boolean;
  onDong: () => void;
  chuongId: string;
  audioUrl?: string | null;
  slugTruyen: string;
  tenTruyen: string;
  soChuong: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tieuDe: string;
  onDungWebSpeech?: () => void;
  tuDongPhatNgay?: boolean;
}) {
  const router = useRouter();
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(audioUrl || null);
  const [dangChuanBi, setDangChuanBi] = useState(false);
  const [soGiayCho, setSoGiayCho] = useState(0);
  const [dangPhat, setDangPhat] = useState(false);
  const [thoiGianHienTai, setThoiGianHienTai] = useState(0);
  const [tongThoiLuong, setTongThoiLuong] = useState(0);
  const [tocDo, setTocDo] = useState(1);
  const [loiYeuCau, setLoiYeuCau] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const daTuDongPhatRef = useRef(false);

  // Khởi tạo tốc độ từ localStorage
  useEffect(() => {
    const daLuu = docCaiDatAudio();
    setTocDo(daLuu.tocDo);
    if (audioRef.current) {
      audioRef.current.playbackRate = daLuu.tocDo;
    }
  }, []);

  // Đồng bộ khi prop audioUrl hoặc chuongId thay đổi (ví dụ khi chuyển chương)
  useEffect(() => {
    setLocalAudioUrl(audioUrl || null);
    setDangChuanBi(false);
    setSoGiayCho(0);
    setThoiGianHienTai(0);
    setTongThoiLuong(0);
    setDangPhat(false);
    setLoiYeuCau(null);
    daTuDongPhatRef.current = false;
  }, [audioUrl, chuongId]);

  // Thiết lập Media Session API
  function capNhatMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Chương ${soChuong}: ${tieuDe}`,
      artist: tenTruyen,
      album: tenTruyen,
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play();
      setDangPhat(true);
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setDangPhat(false);
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          audioRef.current.currentTime - (details.seekOffset || 10),
          0
        );
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.currentTime + (details.seekOffset || 10),
          audioRef.current.duration || 0
        );
      }
    });

    if (soChuongSau) {
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        chuyenChuongTiep();
      });
    } else {
      navigator.mediaSession.setActionHandler('nexttrack', null);
    }
  }

  // Tự động phát khi audioUrl sẵn sàng và có yêu cầu tự phát
  useEffect(() => {
    if (localAudioUrl && tuDongPhatNgay && !daTuDongPhatRef.current) {
      daTuDongPhatRef.current = true;
      onDungWebSpeech?.();
      if (audioRef.current) {
        audioRef.current.playbackRate = tocDo;
        audioRef.current
          .play()
          .then(() => {
            setDangPhat(true);
            capNhatMediaSession();
            // Mồi chương sau vào hàng đợi
            if (chuongIdSau) {
              taoSupabaseClient()
                .rpc('xep_hang_tao_audio', { p_chuong_id: chuongIdSau })
                .then(() => {}, () => {});
            }
          })
          .catch((err) => {
            console.error('Lỗi khi tự động phát audio:', err);
          });
      }
    }
  }, [localAudioUrl, tuDongPhatNgay, tocDo, chuongIdSau, onDungWebSpeech]);

  // Bộ đếm giây và polling kiểm tra audio_url khi đang chuẩn bị
  useEffect(() => {
    if (!dangChuanBi) return;

    // Đếm giây tăng dần
    const timerInterval = setInterval(() => {
      setSoGiayCho((prev) => prev + 1);
    }, 1000);

    // Poll Supabase kiểm tra audio_url mỗi 5 giây
    const pollInterval = setInterval(async () => {
      try {
        const supabase = taoSupabaseClient();
        const { data, error } = await supabase
          .from('chuong')
          .select('audio_url')
          .eq('id', chuongId)
          .maybeSingle();

        if (error) {
          console.warn('Lỗi polling audio_url:', error.message);
          return;
        }

        if (data?.audio_url && data.audio_url.trim() !== '') {
          setLocalAudioUrl(data.audio_url);
          setDangChuanBi(false);
          // Tự động phát khi tạo xong
          setTimeout(() => {
            onDungWebSpeech?.();
            if (audioRef.current) {
              audioRef.current.playbackRate = tocDo;
              audioRef.current
                .play()
                .then(() => {
                  setDangPhat(true);
                  capNhatMediaSession();
                  if (chuongIdSau) {
                    taoSupabaseClient()
                      .rpc('xep_hang_tao_audio', { p_chuong_id: chuongIdSau })
                      .then(() => {}, () => {});
                  }
                })
                .catch((e) => console.error('Lỗi tự động play sau khi tạo xong:', e));
            }
          }, 100);
        }
      } catch (err) {
        console.warn('Lỗi kết nối khi poll audio_url:', err);
      }
    }, 5000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [dangChuanBi, chuongId, chuongIdSau, tocDo, onDungWebSpeech]);

  // Bắt đầu yêu cầu tạo audio
  async function batDauTaoAudio() {
    setDangChuanBi(true);
    setSoGiayCho(0);
    setLoiYeuCau(null);

    const ketQua = await yeuCauTaoAudioNgay(chuongId);
    if (!ketQua.thanhCong) {
      setLoiYeuCau(ketQua.loi || 'Không thể gửi yêu cầu tạo audio.');
    }
  }

  // Điều khiển phát / tạm dừng
  function togglePhat() {
    if (!audioRef.current || !localAudioUrl) return;

    if (dangPhat) {
      audioRef.current.pause();
      setDangPhat(false);
    } else {
      onDungWebSpeech?.();
      audioRef.current.playbackRate = tocDo;
      audioRef.current
        .play()
        .then(() => {
          setDangPhat(true);
          capNhatMediaSession();
          if (chuongIdSau) {
            taoSupabaseClient()
              .rpc('xep_hang_tao_audio', { p_chuong_id: chuongIdSau })
              .then(() => {}, () => {});
          }
        })
        .catch((err) => {
          console.error('Lỗi khi phát audio:', err);
          setDangPhat(false);
        });
    }
  }

  // Tua lùi 10 giây (chỉ trong chương hiện tại)
  function tuaLui10s() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  }

  // Tua tiến 10 giây (chỉ trong chương hiện tại)
  function tuaTien10s() {
    if (!audioRef.current) return;
    const maxTime = audioRef.current.duration || tongThoiLuong;
    audioRef.current.currentTime = Math.min(maxTime, audioRef.current.currentTime + 10);
  }

  // Kéo thanh tiến trình
  function thayDoiTienDo(e: React.ChangeEvent<HTMLInputElement>) {
    const giaTri = Number(e.target.value);
    setThoiGianHienTai(giaTri);
    if (audioRef.current) {
      audioRef.current.currentTime = giaTri;
    }
  }

  // Thay đổi tốc độ đọc
  function doiTocDo(tocDoMoi: number) {
    setTocDo(tocDoMoi);
    ghiCaiDatAudio({ tocDo: tocDoMoi });
    if (audioRef.current) {
      audioRef.current.playbackRate = tocDoMoi;
    }
  }

  // Chuyển chương sau
  function chuyenChuongTiep() {
    if (!soChuongSau) return;
    try {
      sessionStorage.setItem(KHOA_TU_DONG_DOC, String(soChuongSau));
      sessionStorage.setItem(KHOA_MO_MODAL_AUDIO_THAT, '1');
    } catch {
      // Bỏ qua nếu sessionStorage bị chặn
    }
    router.push(`/truyen/${slugTruyen}/chuong/${soChuongSau}`);
  }

  function onAudioEnded() {
    setDangPhat(false);
    if (soChuongSau) {
      chuyenChuongTiep();
    }
  }

  if (!moModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      {/* Hidden HTML5 Audio */}
      {localAudioUrl && (
        <audio
          ref={audioRef}
          src={localAudioUrl}
          preload="metadata"
          onTimeUpdate={() => {
            if (audioRef.current) {
              setThoiGianHienTai(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setTongThoiLuong(audioRef.current.duration || 0);
            }
          }}
          onPlay={() => setDangPhat(true)}
          onPause={() => setDangPhat(false)}
          onEnded={onAudioEnded}
          className="hidden"
        />
      )}

      <div
        className="w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-100 p-5 space-y-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-blue-600 truncate">{tenTruyen}</p>
            <h3 className="text-base font-bold text-gray-900 truncate">
              Chương {soChuong}: {tieuDe}
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

        {/* TH1 & TH2: Chưa có audio hoặc đang chuẩn bị */}
        {!localAudioUrl ? (
          <div className="py-4 text-center space-y-4">
            {!dangChuanBi ? (
              <>
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Audio giọng đọc Neural (Hoài My)</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Chương này chưa có file audio chất lượng cao. Bạn có thể bấm bắt đầu để tạo ngay.
                  </p>
                </div>

                {loiYeuCau && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">{loiYeuCau}</p>
                )}

                <button
                  type="button"
                  onClick={batDauTaoAudio}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Bắt đầu
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center relative">
                  <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Đang chuẩn bị audio...</h4>
                  <p className="text-sm font-medium text-blue-600 mt-1">
                    Đã chờ: {soGiayCho}s
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Hệ thống đang khởi động máy chủ tạo audio. File sẽ tự động phát ngay khi hoàn tất.
                  </p>
                </div>

                {soGiayCho >= 360 && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl text-left">
                    <p className="font-semibold">⚠️ Đang mất nhiều thời gian hơn dự kiến</p>
                    <p className="mt-0.5">
                      Bạn có thể tiếp tục đợi thêm hoặc đóng modal để dùng tạm giọng máy.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* TH3: Đã có file audio - Trình phát */
          <div className="space-y-5 py-2">
            {/* Tiến độ và Thời gian */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={tongThoiLuong || 100}
                step={0.5}
                value={thoiGianHienTai}
                onChange={thayDoiTienDo}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 font-mono">
                <span>{dinhDangThoiGian(thoiGianHienTai)}</span>
                <span>{dinhDangThoiGian(tongThoiLuong)}</span>
              </div>
            </div>

            {/* Bộ điều khiển trung tâm: Tua 10s & Play/Pause */}
            <div className="flex items-center justify-center gap-6">
              {/* Tua lùi 10s */}
              <button
                type="button"
                onClick={tuaLui10s}
                title="Tua lùi 10 giây"
                aria-label="Tua lùi 10 giây"
                className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
                  />
                </svg>
                <span className="text-[10px] font-semibold mt-0.5">10s</span>
              </button>

              {/* Nút Play/Pause Lớn */}
              <button
                type="button"
                onClick={togglePhat}
                aria-label={dangPhat ? 'Tạm dừng' : 'Phát'}
                className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                {dangPhat ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Tua tiến 10s */}
              <button
                type="button"
                onClick={tuaTien10s}
                title="Tua tiến 10 giây"
                aria-label="Tua tiến 10 giây"
                className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z"
                  />
                </svg>
                <span className="text-[10px] font-semibold mt-0.5">10s</span>
              </button>
            </div>

            {/* Tốc độ đọc */}
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

            {soChuongSau && (
              <p className="text-[11px] text-gray-400 text-center">
                Đọc xong sẽ tự động chuyển sang chương sau.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
