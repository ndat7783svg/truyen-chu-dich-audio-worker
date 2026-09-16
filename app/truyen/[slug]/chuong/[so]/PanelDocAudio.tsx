'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';
import {
  CAI_DAT_AUDIO_MAC_DINH,
  GIOI_HAN_TOC_DO,
  docCaiDatAudio,
  ghiCaiDatAudio,
  taoDoanDoc,
  type CaiDatAudio,
} from '@/lib/utils/cai-dat-audio';

const KHOA_TU_DONG_DOC = 'chuongTuDongDocTiep';

export default function PanelDocAudio({
  slugTruyen,
  tenTruyen,
  soChuong,
  soChuongSau,
  chuongIdSau,
  tieuDe,
  noiDung,
  audioUrl,
}: {
  slugTruyen: string;
  tenTruyen: string;
  soChuong: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tieuDe: string;
  noiDung: string;
  audioUrl?: string | null;
}) {
  const router = useRouter();
  const [hoTroWebSpeech, setHoTroWebSpeech] = useState(true);
  const [caiDat, setCaiDat] = useState<CaiDatAudio>(CAI_DAT_AUDIO_MAC_DINH);
  const [moPanel, setMoPanel] = useState(false);

  // State Web Speech API (giọng đọc trình duyệt cũ)
  const [dangDoc, setDangDoc] = useState(false);
  const [dangTamDung, setDangTamDung] = useState(false);

  // State Audio file thật
  const [dangPhatFile, setDangPhatFile] = useState(false);
  const [dangTamDungFile, setDangTamDungFile] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tocDoRef = useRef(CAI_DAT_AUDIO_MAC_DINH.tocDo);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  // Đánh số "thế hệ" mỗi lần chủ động huỷ utterance đang đọc (tạm dừng/đổi tốc độ/đổi chương/đọc
  // lại từ đầu). onend/onerror của utterance cũ so khớp lại số này - khác thì bỏ qua (utterance cũ,
  // không phải utterance hiện tại). Không dùng cờ boolean vì cancel() không đảm bảo luôn bắn
  // onend/onerror cho utterance bị huỷ ở mọi trình duyệt.
  const theHeRef = useRef(0);

  // Khởi tạo cài đặt và kiểm tra Web Speech
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setHoTroWebSpeech(false);
    }
    const daLuu = docCaiDatAudio();
    setCaiDat(daLuu);
    tocDoRef.current = daLuu.tocDo;
    if (audioRef.current) {
      audioRef.current.playbackRate = daLuu.tocDo;
    }
  }, []);

  // Cleanup khi unmount component
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        theHeRef.current += 1;
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Cấu hình Media Session API khi phát file audio
  function capNhatMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Chương ${soChuong}: ${tieuDe}`,
      artist: tenTruyen,
      album: tenTruyen,
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play();
      setDangPhatFile(true);
      setDangTamDungFile(false);
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setDangTamDungFile(true);
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
        try {
          sessionStorage.setItem(KHOA_TU_DONG_DOC, String(soChuongSau));
        } catch {
          // Bỏ qua nếu sessionStorage bị chặn
        }
        router.push(`/truyen/${slugTruyen}/chuong/${soChuongSau}`);
      });
    } else {
      navigator.mediaSession.setActionHandler('nexttrack', null);
    }
  }

  // Chuyển chương: dừng audio cũ và kích hoạt tự động đọc tiếp nếu có cờ
  useEffect(() => {
    // Dừng Web Speech nếu đang chạy
    if (hoTroWebSpeech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      theHeRef.current += 1;
      window.speechSynthesis.cancel();
    }
    setDangDoc(false);
    setDangTamDung(false);

    // Dừng Audio File nếu đang chạy
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setDangPhatFile(false);
    setDangTamDungFile(false);

    try {
      const soTuDongDoc = sessionStorage.getItem(KHOA_TU_DONG_DOC);
      if (soTuDongDoc && Number(soTuDongDoc) === soChuong) {
        sessionStorage.removeItem(KHOA_TU_DONG_DOC);
        if (audioUrl) {
          batDauPhatFile();
        } else if (hoTroWebSpeech) {
          batDauDoc();
        }
      }
    } catch {
      // sessionStorage không khả dụng - bỏ qua tự động đọc tiếp
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoTroWebSpeech, soChuong, audioUrl]);

  // Click outside to close panel
  useEffect(() => {
    if (!moPanel) return;
    function xuLyClickNgoai(suKien: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(suKien.target as Node)) {
        setMoPanel(false);
      }
    }
    document.addEventListener('mousedown', xuLyClickNgoai);
    return () => document.removeEventListener('mousedown', xuLyClickNgoai);
  }, [moPanel]);

  // --- LOGIC PHÁT FILE AUDIO THẬT ---
  function batDauPhatFile() {
    if (chuongIdSau) {
      taoSupabaseClient()
        .rpc('xep_hang_tao_audio', { p_chuong_id: chuongIdSau })
        .then(
          () => {},
          () => {}
        );
    }

    if (hoTroWebSpeech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      theHeRef.current += 1;
      window.speechSynthesis.cancel();
    }
    setDangDoc(false);
    setDangTamDung(false);

    if (audioRef.current) {
      audioRef.current.playbackRate = tocDoRef.current;
      audioRef.current
        .play()
        .then(() => {
          setDangPhatFile(true);
          setDangTamDungFile(false);
          capNhatMediaSession();
        })
        .catch((err) => {
          console.error('Lỗi khi phát audio file:', err);
          setDangPhatFile(false);
          setDangTamDungFile(false);
        });
    }
  }

  function bamNutPhatFile() {
    if (!dangPhatFile) {
      batDauPhatFile();
      return;
    }

    if (dangTamDungFile) {
      if (audioRef.current) {
        audioRef.current.playbackRate = tocDoRef.current;
        audioRef.current.play().then(() => {
          setDangTamDungFile(false);
        });
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setDangTamDungFile(true);
      }
    }
  }

  function onAudioEnded() {
    setDangPhatFile(false);
    setDangTamDungFile(false);
    if (soChuongSau) {
      try {
        sessionStorage.setItem(KHOA_TU_DONG_DOC, String(soChuongSau));
      } catch {
        // sessionStorage không khả dụng - bỏ qua tự động đọc tiếp
      }
      router.push(`/truyen/${slugTruyen}/chuong/${soChuongSau}`);
    }
  }

  // --- LOGIC WEB SPEECH API (GIỮ NGUYÊN HOÀN TOÀN) ---
  function docDoanTiep() {
    const idx = indexRef.current;
    const queue = queueRef.current;

    if (idx >= queue.length) {
      setDangDoc(false);
      setDangTamDung(false);
      if (soChuongSau) {
        try {
          sessionStorage.setItem(KHOA_TU_DONG_DOC, String(soChuongSau));
        } catch {
          // sessionStorage không khả dụng - bỏ qua tự động đọc tiếp
        }
        router.push(`/truyen/${slugTruyen}/chuong/${soChuongSau}`);
      }
      return;
    }

    const theHeKhiTao = theHeRef.current;
    const utter = new SpeechSynthesisUtterance(queue[idx]);
    utter.lang = 'vi-VN';
    utter.rate = tocDoRef.current;
    utter.onend = () => {
      if (theHeKhiTao !== theHeRef.current) return; // utterance cũ đã bị huỷ, bỏ qua
      indexRef.current += 1;
      docDoanTiep();
    };
    utter.onerror = () => {
      if (theHeKhiTao !== theHeRef.current) return; // utterance cũ đã bị huỷ, bỏ qua
      setDangDoc(false);
      setDangTamDung(false);
    };
    window.speechSynthesis.speak(utter);
  }

  function batDauDoc() {
    if (chuongIdSau) {
      taoSupabaseClient()
        .rpc('xep_hang_tao_audio', { p_chuong_id: chuongIdSau })
        .then(
          () => {},
          () => {}
        );
    }

    // Tạm dừng audio file nếu đang phát
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setDangPhatFile(false);
    setDangTamDungFile(false);

    theHeRef.current += 1;
    window.speechSynthesis.cancel();
    queueRef.current = taoDoanDoc(`${tieuDe}. ${noiDung}`);
    indexRef.current = 0;
    setDangDoc(true);
    setDangTamDung(false);
    docDoanTiep();
  }

  function bamNutChinh() {
    if (!dangDoc) {
      batDauDoc();
      return;
    }
    // Không dùng speechSynthesis.pause()/resume() gốc - hành vi rất khác nhau giữa các trình duyệt.
    // Tự huỷ đoạn đang đọc rồi tự đọc lại đúng đoạn đó khi bấm tiếp tục.
    if (dangTamDung) {
      setDangTamDung(false);
      docDoanTiep();
    } else {
      theHeRef.current += 1;
      window.speechSynthesis.cancel();
      setDangTamDung(true);
    }
  }

  function doiTocDo(tocDoMoi: number) {
    const caiDatMoi = { tocDo: tocDoMoi };
    setCaiDat(caiDatMoi);
    ghiCaiDatAudio(caiDatMoi);
    tocDoRef.current = tocDoMoi;

    if (audioRef.current) {
      audioRef.current.playbackRate = tocDoMoi;
    }

    if (dangDoc && !dangTamDung) {
      theHeRef.current += 1;
      window.speechSynthesis.cancel();
      docDoanTiep();
    }
  }

  // Nếu không hỗ trợ Web Speech và cũng không có audioUrl thì ẩn nút
  if (!hoTroWebSpeech && !audioUrl) return null;

  const nhanNutWebSpeech = !dangDoc ? 'Nghe' : dangTamDung ? 'Tiếp tục' : 'Tạm dừng';
  const nhanNutPhatFile = !dangPhatFile
    ? 'Nghe file'
    : dangTamDungFile
    ? 'Tiếp tục file'
    : 'Tạm dừng file';

  const dangPhatAmThanh = dangDoc || dangPhatFile;

  return (
    <div ref={panelRef} className="absolute top-3 right-14 z-40">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onEnded={onAudioEnded}
          onPlay={() => {
            setDangPhatFile(true);
            setDangTamDungFile(false);
          }}
          onPause={() => {
            if (dangPhatFile) {
              setDangTamDungFile(true);
            }
          }}
          className="hidden"
        />
      )}

      <button
        type="button"
        onClick={() => setMoPanel((truoc) => !truoc)}
        aria-label="Nghe chương"
        className={`w-9 h-9 rounded-full border flex items-center justify-center bg-white/80 text-gray-900 ${
          dangPhatAmThanh ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072M12 6v12M6 9v6a1 1 0 001 1h2l3.5 3.5a.5.5 0 00.5-.354V5.854a.5.5 0 00-.854-.354L9 9H7a1 1 0 00-1 1z"
          />
        </svg>
      </button>

      {moPanel && (
        <div className="absolute right-0 mt-2 w-60 rounded-lg border bg-white text-gray-900 p-4 shadow-lg space-y-4 z-20">
          {audioUrl ? (
            <div className="space-y-3">
              {/* Nút Nghe File thật (Ưu tiên) */}
              <button
                type="button"
                onClick={bamNutPhatFile}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 text-sm shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  {dangPhatFile && !dangTamDungFile ? (
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  ) : (
                    <path d="M8 5v14l11-7z" />
                  )}
                </svg>
                {nhanNutPhatFile}
              </button>

              {/* Nút Nghe giọng máy cũ (Web Speech) */}
              {hoTroWebSpeech && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={bamNutChinh}
                    className="w-full rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-1.5 text-xs transition-colors"
                  >
                    {nhanNutWebSpeech} (Giọng máy)
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Chỉ có Web Speech API cũ khi chưa có audio file */
            <button
              type="button"
              onClick={bamNutChinh}
              className="w-full rounded-lg border border-blue-500 text-blue-600 font-medium py-2 text-sm"
            >
              {nhanNutWebSpeech}
            </button>
          )}

          <div>
            <p className="text-xs font-semibold uppercase mb-2">
              Tốc độ đọc <span className="normal-case font-normal">{caiDat.tocDo.toFixed(2)}x</span>
            </p>
            <input
              type="range"
              min={GIOI_HAN_TOC_DO.min}
              max={GIOI_HAN_TOC_DO.max}
              step={0.25}
              value={caiDat.tocDo}
              onChange={(e) => doiTocDo(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          {soChuongSau && (
            <p className="text-xs text-gray-500">Đọc xong sẽ tự chuyển sang chương sau.</p>
          )}
        </div>
      )}
    </div>
  );
}
