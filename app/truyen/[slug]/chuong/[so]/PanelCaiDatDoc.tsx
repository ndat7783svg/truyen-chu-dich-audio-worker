'use client';

import { useEffect, useRef, useState } from 'react';
import {
  GIOI_HAN_CO_CHU,
  GIOI_HAN_GIAI_DONG,
  type CaiDatDoc,
  type MauNen,
  type Phong,
} from '@/lib/utils/cai-dat-doc';

export default function PanelCaiDatDoc({
  caiDat,
  onDoiCaiDat,
}: {
  caiDat: CaiDatDoc;
  onDoiCaiDat: (caiDatMoi: CaiDatDoc) => void;
}) {
  const [moPanel, setMoPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moPanel) return;

    function xuLyClickNgoai(suKien: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(suKien.target as Node)) {
        setMoPanel(false);
      }
    }

    document.addEventListener('mousedown', xuLyClickNgoai);
    return () => {
      document.removeEventListener('mousedown', xuLyClickNgoai);
    };
  }, [moPanel]);

  function doiMauNen(mauNen: MauNen) {
    onDoiCaiDat({ ...caiDat, mauNen });
  }

  function doiCoChu(coChu: number) {
    const gioiHan = Math.min(GIOI_HAN_CO_CHU.max, Math.max(GIOI_HAN_CO_CHU.min, coChu));
    onDoiCaiDat({ ...caiDat, coChu: gioiHan });
  }

  function doiPhong(phong: Phong) {
    onDoiCaiDat({ ...caiDat, phong });
  }

  function doiGiaiDong(giaiDong: number) {
    onDoiCaiDat({ ...caiDat, giaiDong });
  }

  return (
    <div ref={panelRef} className="absolute top-3 right-3 z-40">
      <button
        type="button"
        onClick={() => setMoPanel((truoc) => !truoc)}
        aria-label="Cài đặt đọc"
        className="w-9 h-9 rounded-full border flex items-center justify-center text-sm font-semibold bg-white/80 text-gray-900"
      >
        Aa
      </button>
      {moPanel && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-white text-gray-900 p-4 shadow-lg space-y-4 z-20">
          <div>
            <p className="text-xs font-semibold uppercase mb-2">Màu nền</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doiMauNen('sang')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.mauNen === 'sang' ? 'border-blue-500' : ''}`}
              >
                Sáng
              </button>
              <button
                type="button"
                onClick={() => doiMauNen('vang')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.mauNen === 'vang' ? 'border-blue-500' : ''}`}
              >
                Vàng
              </button>
              <button
                type="button"
                onClick={() => doiMauNen('toi')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.mauNen === 'toi' ? 'border-blue-500' : ''}`}
              >
                Tối
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">
              Cỡ chữ nội dung <span className="normal-case font-normal">{caiDat.coChu}px</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => doiCoChu(caiDat.coChu - 1)}
                aria-label="Giảm cỡ chữ"
                className="w-7 h-7 rounded-full border"
              >
                A-
              </button>
              <input
                type="range"
                min={GIOI_HAN_CO_CHU.min}
                max={GIOI_HAN_CO_CHU.max}
                step={1}
                value={caiDat.coChu}
                onChange={(e) => doiCoChu(Number(e.target.value))}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => doiCoChu(caiDat.coChu + 1)}
                aria-label="Tăng cỡ chữ"
                className="w-7 h-7 rounded-full border"
              >
                A+
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">Phông chữ</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doiPhong('hien-dai')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.phong === 'hien-dai' ? 'border-blue-500' : ''}`}
              >
                Hiện đại
              </button>
              <button
                type="button"
                onClick={() => doiPhong('co-dien')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.phong === 'co-dien' ? 'border-blue-500' : ''}`}
              >
                Cổ điển
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">
              Giãn dòng{' '}
              <span className="normal-case font-normal">{caiDat.giaiDong.toFixed(2)}</span>
            </p>
            <input
              type="range"
              min={GIOI_HAN_GIAI_DONG.min}
              max={GIOI_HAN_GIAI_DONG.max}
              step={0.25}
              value={caiDat.giaiDong}
              onChange={(e) => doiGiaiDong(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
