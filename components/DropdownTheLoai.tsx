'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import BieuTuong from './BieuTuong';

// Bấm để mở (dùng được trên điện thoại), di chuột vào cũng mở trên máy tính; bấm ra ngoài hoặc chọn 1 thể loại để đóng.
export default function DropdownTheLoai({
  dsTheLoai,
}: {
  dsTheLoai: { ten: string; slug: string }[];
}) {
  const [moRong, setMoRong] = useState(false);
  const hopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moRong) return;
    function bamRaNgoai(e: MouseEvent) {
      if (hopRef.current && !hopRef.current.contains(e.target as Node)) setMoRong(false);
    }
    document.addEventListener('mousedown', bamRaNgoai);
    return () => document.removeEventListener('mousedown', bamRaNgoai);
  }, [moRong]);

  if (dsTheLoai.length === 0) return null;

  return (
    <div
      ref={hopRef}
      className="relative"
      // Chỉ mở theo di chuột với chuột thật: trên điện thoại, cú chạm cũng giả lập "di chuột vào" rồi mới
      // "bấm" -> nếu không lọc, menu vừa mở đã bị nút bấm đóng lại ngay.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setMoRong(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setMoRong(false)}
    >
      <button
        type="button"
        onClick={() => setMoRong(true)}
        aria-expanded={moRong}
        className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium hover:bg-surface"
      >
        <BieuTuong ten="the-loai" className="h-4 w-4" />
        <span className="hidden sm:inline">Thể loại</span>
      </button>
      {moRong && (
        <div className="absolute left-0 top-full z-20 pt-1">
          <ul className="grid max-h-80 w-72 grid-cols-2 gap-0.5 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg">
            {dsTheLoai.map((tl) => (
              <li key={tl.slug}>
                <Link
                  href={`/the-loai/${tl.slug}`}
                  className="block truncate rounded-lg px-2.5 py-2 text-sm hover:bg-surface hover:text-accent"
                  onClick={() => setMoRong(false)}
                >
                  {tl.ten}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
