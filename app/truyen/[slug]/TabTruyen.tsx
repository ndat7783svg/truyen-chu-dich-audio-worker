'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';

function theoDoiHash(baoThayDoi: () => void) {
  window.addEventListener('hashchange', baoThayDoi);
  return () => window.removeEventListener('hashchange', baoThayDoi);
}

// 2 tab "Giới thiệu" / "Chương". Cả 2 khối đều được server render sẵn (chỉ ẩn/hiện), để không mất nội dung
// khi chưa chạy JS. Link có đuôi #danh-sach-chuong (vd nút Danh sách ở trang đọc) sẽ mở thẳng tab Chương.
export default function TabTruyen({
  gioiThieu,
  danhSachChuong,
  soChuong,
}: {
  gioiThieu: ReactNode;
  danhSachChuong: ReactNode;
  soChuong: number;
}) {
  const moTuLink = useSyncExternalStore(
    theoDoiHash,
    () => window.location.hash === '#danh-sach-chuong',
    () => false
  );
  const [tabDaChon, setTab] = useState<'gioi-thieu' | 'chuong' | null>(null);
  const tab = tabDaChon ?? (moTuLink ? 'chuong' : 'gioi-thieu');

  const nutTab = (gia: 'gioi-thieu' | 'chuong', nhan: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === gia}
      onClick={() => setTab(gia)}
      className={`-mb-px border-b-2 px-1 py-3 text-sm font-semibold transition-colors ${
        tab === gia ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {nhan}
    </button>
  );

  return (
    <div id="danh-sach-chuong" className="scroll-mt-16">
      <div role="tablist" className="flex gap-6 border-b border-border">
        {nutTab('gioi-thieu', 'Giới thiệu')}
        {nutTab('chuong', `Chương (${soChuong})`)}
      </div>
      <div className={tab === 'gioi-thieu' ? '' : 'hidden'}>{gioiThieu}</div>
      <div className={tab === 'chuong' ? '' : 'hidden'}>{danhSachChuong}</div>
    </div>
  );
}
