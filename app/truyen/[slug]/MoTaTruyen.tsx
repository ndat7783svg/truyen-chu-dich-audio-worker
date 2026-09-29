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
    <section>
      <p
        ref={noiDungRef}
        className={`whitespace-pre-line leading-relaxed text-foreground/85 ${moRong ? '' : 'line-clamp-5'}`}
      >
        {moTa}
      </p>
      {(canThuGon || moRong) && (
        <button
          type="button"
          onClick={() => setMoRong((truoc) => !truoc)}
          className="mt-1 text-sm font-medium text-accent hover:underline"
        >
          {moRong ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
