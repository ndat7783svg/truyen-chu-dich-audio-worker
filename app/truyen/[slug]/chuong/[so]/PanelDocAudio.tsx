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
import ModalNgheAudioThat from './ModalNgheAudioThat';
import type { ThongTinChuongMoi } from './KhungDocChuong';

const KHOA_TU_DONG_DOC = 'chuongTuDongDocTiep';
const KHOA_MO_MODAL_AUDIO_THAT = 'moModalAudioThat';

export default function PanelDocAudio({
  chuongId,
  slugTruyen,
  tenTruyen,
  truyenId,
  soChuong,
  soChuongSau,
  chuongIdSau,
  tieuDe,
  noiDung,
  audioUrl,
  onChuyenChuongMoi,
}: {
  chuongId: string;
  slugTruyen: string;
  tenTruyen: string;
  truyenId: string;
  soChuong: number;
  soChuongSau?: number;
  chuongIdSau?: string;
  tieuDe: string;
  noiDung: string;
  audioUrl?: string | null;
  onChuyenChuongMoi?: (thongTinMoi: ThongTinChuongMoi) => void;
}) {

  const router = useRouter();
  const [hoTroWebSpeech, setHoTroWebSpeech] = useState(true);
  const [caiDat, setCaiDat] = useState<CaiDatAudio>(CAI_DAT_AUDIO_MAC_DINH);
  const [moPanel, setMoPanel] = useState(false);

  // State Modal Audio Thật
  const [moModalThat, setMoModalThat] = useState(false);
  const [tuDongPhatModal, setTuDongPhatModal] = useState(false);

  // State Web Speech API (giọng máy trình duyệt)
  const [dangDoc, setDangDoc] = useState(false);
  const [dangTamDung, setDangTamDung] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const tocDoRef = useRef(CAI_DAT_AUDIO_MAC_DINH.tocDo);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  // Đánh số "thế hệ" mỗi lần huỷ utterance đang đọc
  const theHeRef = useRef(0);

  // Khởi tạo cài đặt và kiểm tra Web Speech
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setHoTroWebSpeech(false);
    }
    const daLuu = docCaiDatAudio();
    setCaiDat(daLuu);
    tocDoRef.current = daLuu.tocDo;
  }, []);

  // Cleanup khi unmount component
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        theHeRef.current += 1;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Dừng Web Speech
  function dungWebSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      theHeRef.current += 1;
      window.speechSynthesis.cancel();
    }
    setDangDoc(false);
    setDangTamDung(false);
  }

  // Chuyển chương: dừng audio cũ và kích hoạt tự động đọc tiếp nếu có cờ trong sessionStorage
  useEffect(() => {
    // Dừng Web Speech nếu đang chạy
    dungWebSpeech();

    try {
      const soTuDongDoc = sessionStorage.getItem(KHOA_TU_DONG_DOC);
      const coMoModal = sessionStorage.getItem(KHOA_MO_MODAL_AUDIO_THAT);

      if (soTuDongDoc && Number(soTuDongDoc) === soChuong) {
        sessionStorage.removeItem(KHOA_TU_DONG_DOC);

        if (coMoModal === '1') {
          sessionStorage.removeItem(KHOA_MO_MODAL_AUDIO_THAT);
          setMoModalThat(true);
          setTuDongPhatModal(true);
        } else if (hoTroWebSpeech) {
          batDauDoc();
        }
      }
    } catch {
      // sessionStorage không khả dụng - bỏ qua tự động đọc tiếp
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoTroWebSpeech, soChuong, audioUrl]);

  // Click outside to close panel dropdown
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

  // --- LOGIC WEB SPEECH API (GIỮ NGUYÊN 100%) ---
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
          // Bỏ qua nếu sessionStorage bị chặn
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
      if (theHeKhiTao !== theHeRef.current) return;
      indexRef.current += 1;
      docDoanTiep();
    };
    utter.onerror = () => {
      if (theHeKhiTao !== theHeRef.current) return;
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

    if (dangDoc && !dangTamDung) {
      theHeRef.current += 1;
      window.speechSynthesis.cancel();
      docDoanTiep();
    }
  }

  const nhanNutWebSpeech = !dangDoc ? 'Nghe' : dangTamDung ? 'Tiếp tục' : 'Tạm dừng';
  const dangPhatAmThanh = dangDoc || moModalThat;

  return (
    <div ref={panelRef} className="absolute top-3 right-14 z-40">
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
        <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-white text-gray-900 p-4 shadow-xl space-y-4 z-20">
          <div className="space-y-2.5">
            {/* Nút Mở Modal Audio Thật (luôn hiển thị) */}
            <button
              type="button"
              onClick={() => {
                setMoModalThat(true);
                setMoPanel(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-3 text-sm shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              Nghe audio thật (AI)
            </button>

            {/* Nút Nghe Web Speech (Giọng máy trình duyệt) */}
            {hoTroWebSpeech && (
              <button
                type="button"
                onClick={bamNutChinh}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-3 text-xs transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
                  />
                </svg>
                {nhanNutWebSpeech} (Giọng máy)
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">
              Tốc độ đọc giọng máy <span className="normal-case font-normal">{caiDat.tocDo.toFixed(2)}x</span>
            </p>
            <input
              type="range"
              min={GIOI_HAN_TOC_DO.min}
              max={GIOI_HAN_TOC_DO.max}
              step={0.25}
              value={caiDat.tocDo}
              onChange={(e) => doiTocDo(Number(e.target.value))}
              className="w-full cursor-pointer accent-blue-600"
            />
          </div>

          {soChuongSau && (
            <p className="text-xs text-gray-500">Đọc xong sẽ tự chuyển sang chương sau.</p>
          )}
        </div>
      )}

      {/* Modal Trình Phát Audio Thật */}
      <ModalNgheAudioThat
        moModal={moModalThat}
        onDong={() => {
          setMoModalThat(false);
          setTuDongPhatModal(false);
        }}
        chuongId={chuongId}
        audioUrl={audioUrl}
        slugTruyen={slugTruyen}
        tenTruyen={tenTruyen}
        truyenId={truyenId}
        soChuong={soChuong}
        soChuongSau={soChuongSau}
        chuongIdSau={chuongIdSau}
        tieuDe={tieuDe}
        onDungWebSpeech={dungWebSpeech}
        tuDongPhatNgay={tuDongPhatModal}
        onChuyenChuongMoi={onChuyenChuongMoi}
      />
    </div>
  );
}
