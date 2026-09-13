'use client';

import { useEffect, useRef, useState } from 'react';

export default function MoTaTruyen({ moTa }: { moTa: string }) {
  const [moRong, setMoRong] = useState(false);
  const [canThuGon, setCanThuGon] = useState(false);
  const noiDungRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = noiDungRef.current;
    if (!el) return;
    setCanThuGon(el.scrollHeight > el.clientHeight + 1);
  }, [moTa]);

  return (
    <section className="mt-4">
      <h2 className="font-bold text-lg mb-2">Giới thiệu truyện</h2>
      <p
        ref={noiDungRef}
        className={`text-muted-foreground whitespace-pre-line ${moRong ? '' : 'line-clamp-4'}`}
      >
        {moTa}
      </p>
      {(canThuGon || moRong) && (
        <button
          type="button"
          onClick={() => setMoRong((truoc) => !truoc)}
          className="mt-1 text-sm text-blue-600 hover:underline"
        >
          {moRong ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
