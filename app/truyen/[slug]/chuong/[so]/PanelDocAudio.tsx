'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  soChuong,
  soChuongSau,
  tieuDe,
  noiDung,
}: {
  slugTruyen: string;
  soChuong: number;
  soChuongSau?: number;
  tieuDe: string;
  noiDung: string;
}) {
  const router = useRouter();
  const [hoTro, setHoTro] = useState(true);
  const [caiDat, setCaiDat] = useState<CaiDatAudio>(CAI_DAT_AUDIO_MAC_DINH);
  const [moPanel, setMoPanel] = useState(false);
  const [dangDoc, setDangDoc] = useState(false);
  const [dangTamDung, setDangTamDung] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const tocDoRef = useRef(CAI_DAT_AUDIO_MAC_DINH.tocDo);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setHoTro(false);
      return;
    }
    const daLuu = docCaiDatAudio();
    setCaiDat(daLuu);
    tocDoRef.current = daLuu.tocDo;
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    // Chương vừa đổi (dù tự động hay người dùng tự bấm) - luôn dừng audio của chương cũ trước,
    // tránh tình trạng đọc lệch nội dung khi người dùng tự điều hướng trong lúc đang nghe dở.
    if (hoTro) window.speechSynthesis.cancel();
    setDangDoc(false);
    setDangTamDung(false);

    if (!hoTro) return;
    try {
      const soTuDongDoc = sessionStorage.getItem(KHOA_TU_DONG_DOC);
      if (soTuDongDoc && Number(soTuDongDoc) === soChuong) {
        sessionStorage.removeItem(KHOA_TU_DONG_DOC);
        batDauDoc();
      }
    } catch {
      // sessionStorage không khả dụng - bỏ qua tự động đọc tiếp
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoTro, soChuong]);

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

    const utter = new SpeechSynthesisUtterance(queue[idx]);
    utter.lang = 'vi-VN';
    utter.rate = tocDoRef.current;
    utter.onend = () => {
      indexRef.current += 1;
      docDoanTiep();
    };
    utter.onerror = () => {
      setDangDoc(false);
      setDangTamDung(false);
    };
    window.speechSynthesis.speak(utter);
  }

  function batDauDoc() {
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
      window.speechSynthesis.resume();
      setDangTamDung(false);
    } else {
      window.speechSynthesis.pause();
      setDangTamDung(true);
    }
  }

  function doiTocDo(tocDoMoi: number) {
    const caiDatMoi = { tocDo: tocDoMoi };
    setCaiDat(caiDatMoi);
    ghiCaiDatAudio(caiDatMoi);
    tocDoRef.current = tocDoMoi;
    if (dangDoc && !dangTamDung) {
      window.speechSynthesis.cancel();
      docDoanTiep();
    }
  }

  if (!hoTro) return null;

  const nhanNutChinh = !dangDoc ? 'Nghe' : dangTamDung ? 'Tiếp tục' : 'Tạm dừng';

  return (
    <div ref={panelRef} className="absolute top-3 right-14 z-40">
      <button
        type="button"
        onClick={() => setMoPanel((truoc) => !truoc)}
        aria-label="Nghe chương"
        className={`w-9 h-9 rounded-full border flex items-center justify-center bg-white/80 text-gray-900 ${
          dangDoc ? 'ring-2 ring-blue-500' : ''
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
        <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-white text-gray-900 p-4 shadow-lg space-y-4 z-20">
          <button
            type="button"
            onClick={bamNutChinh}
            className="w-full rounded-lg border border-blue-500 text-blue-600 font-medium py-2 text-sm"
          >
            {nhanNutChinh}
          </button>
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
              className="w-full"
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
