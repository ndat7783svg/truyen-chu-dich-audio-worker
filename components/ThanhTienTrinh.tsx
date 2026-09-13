'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ThanhTienTrinh() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dangTai, setDangTai] = useState(false);
  const dangDieuHuongRef = useRef(false);

  useEffect(() => {
    function xuLyClick(suKien: MouseEvent) {
      const the = (suKien.target as HTMLElement)?.closest('a');
      if (!the) return;
      const href = the.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || the.target === '_blank') {
        return;
      }
      dangDieuHuongRef.current = true;
      setDangTai(true);
    }
    document.addEventListener('click', xuLyClick);
    return () => document.removeEventListener('click', xuLyClick);
  }, []);

  useEffect(() => {
    if (dangDieuHuongRef.current) {
      dangDieuHuongRef.current = false;
      setDangTai(false);
    }
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className={`fixed top-0 left-0 z-50 h-0.5 bg-blue-600 transition-opacity duration-200 ${
        dangTai ? 'opacity-100 animate-thanh-tien-trinh' : 'w-0 opacity-0'
      }`}
    />
  );
}
