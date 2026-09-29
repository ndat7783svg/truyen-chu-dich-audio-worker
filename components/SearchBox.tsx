'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BieuTuong from './BieuTuong';

// Desktop: ô tìm kiếm luôn hiện. Mobile: chỉ hiện icon kính lúp, bấm vào mới mở ô tìm kiếm phủ ngang header.
export default function SearchBox({ defaultValue }: { defaultValue: string }) {
  const [gia, setGia] = useState(defaultValue);
  const [moMobile, setMoMobile] = useState(false);
  const oNhapMobileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (moMobile) oNhapMobileRef.current?.focus();
  }, [moMobile]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (gia.trim()) params.set('q', gia.trim());
    setMoMobile(false);
    router.push(`/?${params.toString()}`);
  }

  const oNhap = (ref?: React.Ref<HTMLInputElement>) => (
    <input
      ref={ref}
      type="search"
      value={gia}
      onChange={(e) => setGia(e.target.value)}
      placeholder="Tìm truyện theo tên..."
      aria-label="Tìm truyện theo tên"
      className="h-10 min-w-0 flex-1 rounded-full border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-accent"
    />
  );

  return (
    <>
      <form onSubmit={submit} className="relative hidden w-full md:flex">
        <BieuTuong
          ten="tim-kiem"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        {oNhap()}
      </form>

      <button
        type="button"
        onClick={() => setMoMobile(true)}
        aria-label="Tìm kiếm"
        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface md:hidden"
      >
        <BieuTuong ten="tim-kiem" />
      </button>
      {moMobile && (
        <form
          onSubmit={submit}
          className="absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 bg-background px-4 md:hidden"
        >
          <div className="relative flex flex-1">
            <BieuTuong
              ten="tim-kiem"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            {oNhap(oNhapMobileRef)}
          </div>
          <button
            type="button"
            onClick={() => setMoMobile(false)}
            className="shrink-0 px-1 text-sm text-muted-foreground"
          >
            Huỷ
          </button>
        </form>
      )}
    </>
  );
}
