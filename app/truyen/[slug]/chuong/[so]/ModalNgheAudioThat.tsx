'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';
import {
  GIOI_HAN_TOC_DO,
  docCaiDatAudio,
  ghiCaiDatAudio,
} from '@/lib/utils/cai-dat-audio';
import { yeuCauTaoAudioNgay } from './actions-audio';
import type { ThongTinChuongMoi } from './KhungDocChuong';

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
  truyenId,
  soChuong,
  soChuongSau,
  chuongIdSau,
  tieuDe,
  onDungWebSpeech,
  tuDongPhatNgay,
  onChuyenChuongMoi,
}: {
  moModal: boolean;
  onDong: () => void;
  chuongId: string;
  audioUrl?: string | null;
  slugTruyen: string;
  tenTruyen: string;
  truyenId: string;
  soChuong: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tieuDe: string;
  onDungWebSpeech?: () => void;
  tuDongPhatNgay?: boolean;
  onChuyenChuongMoi?: (thongTinMoi: ThongTinChuongMoi) => void;
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

  // State thông báo chặn VIP khi chuyển chương tự động
  const [khoaVip, setKhoaVip] = useState<{ soChuong: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const daTuDongPhatRef = useRef(false);
  const dangChuyenChuongRef = useRef(false);

  // Khi chuyenChuongTiepClient() tự đổi chuongId (không qua điều hướng trang), effect đồng bộ
  // theo prop bên dưới KHÔNG được chạy - vì nó sẽ ghi đè state (đặc biệt dangChuanBi=true vừa
  // bật lên) do prop chuongId cũng đổi theo cùng lúc. Set cờ này ngay trước khi đổi state để
  // effect bỏ qua đúng 1 lần, rồi tự xoá cờ.
  const boQuaDongBoRef = useRef(false);

  // Chỉ tạo portal sau khi đã mount ở client (document chưa tồn tại lúc render server)
  const [daMount, setDaMount] = useState(false);
  useEffect(() => {
    setDaMount(true);
  }, []);

  // Khởi tạo tốc độ từ localStorage
  useEffect(() => {
    const daLuu = docCaiDatAudio();
    setTocDo(daLuu.tocDo);
    if (audioRef.current) {
      audioRef.current.playbackRate = daLuu.tocDo;
    }
  }, []);

  // Đồng bộ khi prop audioUrl hoặc chuongId thay đổi (ví dụ khi load trang mới hoặc bấm Link
  // điều hướng chương thường). KHÔNG chạy khi chuongId đổi do chuyenChuongTiepClient tự set
  // (xem boQuaDongBoRef).
  useEffect(() => {
    if (boQuaDongBoRef.current) {
      boQuaDongBoRef.current = false;
      return;
    }
    setLocalAudioUrl(audioUrl || null);
    setDangChuanBi(false);
    setSoGiayCho(0);
    setThoiGianHienTai(0);
    setTongThoiLuong(0);
    setDangPhat(false);
    setLoiYeuCau(null);
    setKhoaVip(null);
    daTuDongPhatRef.current = false;
  }, [audioUrl, chuongId]);

  // Thiết lập Media Session API
  function capNhatMediaSession(soChuongMoi = soChuong, tieuDeMoi = tieuDe, coChuongSau = Boolean(soChuongSau)) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Chương ${soChuongMoi}: ${tieuDeMoi}`,
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

    if (coChuongSau) {
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        chuyenChuongTiepClient();
      });
    } else {
      navigator.mediaSession.setActionHandler('nexttrack', null);
    }
  }

  // Cập nhật Media Session khi metadata thay đổi
  useEffect(() => {
    capNhatMediaSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soChuong, tieuDe, tenTruyen, soChuongSau]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Chuyển chương âm thầm phía client (không reload trang)
  async function chuyenChuongTiepClient() {
    if (!chuongIdSau || !soChuongSau || dangChuyenChuongRef.current) {
      // Nếu không có hàm callback client và có soChuongSau -> fallback sang router.push cũ
      if (!onChuyenChuongMoi && soChuongSau) {
        try {
          sessionStorage.setItem(KHOA_TU_DONG_DOC, String(soChuongSau));
          sessionStorage.setItem(KHOA_MO_MODAL_AUDIO_THAT, '1');
        } catch {}
        router.push(`/truyen/${slugTruyen}/chuong/${soChuongSau}`);
      }
      return;
    }

    dangChuyenChuongRef.current = true;
    setLoiYeuCau(null);

    try {
      const supabase = taoSupabaseClient();

      // 1. Lấy metadata chương kế tiếp từ Supabase client
      const { data: chuongMoi, error: errChuong } = await supabase
        .from('chuong')
        .select('id, truyen_id, so_chuong, tieu_de, audio_url')
        .eq('id', chuongIdSau)
        .maybeSingle();

      if (errChuong || !chuongMoi) {
        console.error('Lỗi khi tải thông tin chương mới:', errChuong);
        dangChuyenChuongRef.current = false;
        return;
      }

      // 2. Lấy nội dung chữ qua RPC (SECURITY DEFINER, tự gate VIP/free)
      const { data: noiDungMoi, error: errNoiDung } = await supabase.rpc('lay_noi_dung_chuong', {
        p_chuong_id: chuongMoi.id,
      });

      if (errNoiDung) {
        console.error('Lỗi khi gọi RPC lay_noi_dung_chuong:', errNoiDung);
        dangChuyenChuongRef.current = false;
        return;
      }

      // 3. Nếu là chương VIP mà chưa đủ quyền (RPC trả về null) -> dừng audio, hiện VIP modal
      if (noiDungMoi == null) {
        setDangPhat(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setKhoaVip({ soChuong: chuongMoi.so_chuong });
        dangChuyenChuongRef.current = false;
        return;
      }

      // 4. Lấy thông tin chuongTruoc và chuongSau của chương mới
      const [{ data: chuongTruocMoi }, { data: chuongSauMoi }] = await Promise.all([
        supabase
          .from('chuong')
          .select('so_chuong')
          .eq('truyen_id', truyenId)
          .lt('so_chuong', chuongMoi.so_chuong)
          .order('so_chuong', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('chuong')
          .select('id, so_chuong')
          .eq('truyen_id', truyenId)
          .gt('so_chuong', chuongMoi.so_chuong)
          .order('so_chuong', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      // 5. Cập nhật state hiển thị của trang đọc ngoài (nội dung, tiêu đề, link nav, URL replaceState)
      boQuaDongBoRef.current = true;
      onChuyenChuongMoi?.({
        chuongId: chuongMoi.id,
        soChuong: chuongMoi.so_chuong,
        tieuDe: chuongMoi.tieu_de,
        noiDung: noiDungMoi,
        audioUrl: chuongMoi.audio_url ?? null,
        soChuongTruoc: chuongTruocMoi?.so_chuong,
        soChuongSau: chuongSauMoi?.so_chuong,
        chuongIdSau: chuongSauMoi?.id,
      });

      setKhoaVip(null);
      capNhatMediaSession(chuongMoi.so_chuong, chuongMoi.tieu_de, Boolean(chuongSauMoi?.so_chuong));

      // 6. Xử lý phát audio chương mới
      if (chuongMoi.audio_url && chuongMoi.audio_url.trim() !== '') {
        // Đã có audio file -> phát ngay
        setLocalAudioUrl(chuongMoi.audio_url);
        setDangChuanBi(false);
        setSoGiayCho(0);
        setThoiGianHienTai(0);
        setTongThoiLuong(0);

        // Mồi trước chương kế-kế-tiếp vào hàng đợi
        if (chuongSauMoi?.id) {
          supabase
            .rpc('xep_hang_tao_audio', { p_chuong_id: chuongSauMoi.id })
            .then(() => {}, () => {});
        }

        setTimeout(() => {
          onDungWebSpeech?.();
          if (audioRef.current) {
            audioRef.current.playbackRate = tocDo;
            audioRef.current
              .play()
              .then(() => {
                setDangPhat(true);
              })
              .catch((e) => console.error('Lỗi khi tự động play chương mới:', e));
          }
        }, 100);
      } else {
        // Chưa có audio -> Tự động chuyển sang trạng thái chuẩn bị + kích hoạt tạo audio
        setLocalAudioUrl(null);
        setDangChuanBi(true);
        setSoGiayCho(0);
        setThoiGianHienTai(0);
        setTongThoiLuong(0);
        setDangPhat(false);

        yeuCauTaoAudioNgay(chuongMoi.id).then((res) => {
          if (!res.thanhCong) {
            setLoiYeuCau(res.loi || 'Không thể gửi yêu cầu tạo audio.');
          }
        });
      }
    } catch (err) {
      console.error('Lỗi trong chuyenChuongTiepClient:', err);
    } finally {
      dangChuyenChuongRef.current = false;
    }
  }

  function onAudioEnded() {
    setDangPhat(false);
    if (soChuongSau) {
      chuyenChuongTiepClient();
    }
  }

  // Thẻ audio được đưa vào 1 portal RIÊNG, luôn render bất kể modal đóng/mở
  const phanTuAudio = daMount && localAudioUrl
    ? createPortal(
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
        />,
        document.body
      )
    : null;

  if (!moModal || !daMount) {
    return phanTuAudio;
  }

  return (
    <>
      {phanTuAudio}
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white text-gray-900 shadow-2xl border border-gray-100 p-5 space-y-5 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

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

            {/* TRƯỜNG HỢP: BỊ CHẶN VIP */}
            {khoaVip ? (
              <div className="py-4 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">Chương {khoaVip.soChuong} cần gói VIP</h4>
                  <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                    50 chương đầu đọc và nghe miễn phí. Từ chương {khoaVip.soChuong} trở đi, vui lòng đăng nhập và nâng cấp gói VIP để tiếp tục thưởng thức.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={`/truyen/${slugTruyen}/chuong/${khoaVip.soChuong}`}
                    onClick={onDong}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>💎</span> Nâng cấp gói VIP để nghe tiếp
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setKhoaVip(null);
                      onDong();
                    }}
                    className="w-full py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
                  >
                    Đóng trình phát
                  </button>
                </div>
              </div>
            ) : !localAudioUrl ? (
              /* TRƯỜNG HỢP: Chưa có audio hoặc đang chuẩn bị */
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
                        Hệ thống đang xử lý audio chất lượng cao. File sẽ tự động phát ngay khi hoàn tất.
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
              /* TRƯỜNG HỢP: Đã có file audio - Trình phát */
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
        </div>,
        document.body
      )}
    </>
  );
}
