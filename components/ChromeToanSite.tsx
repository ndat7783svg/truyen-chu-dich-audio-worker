'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const MAU_TRANG_DOC_CHUONG = /^\/truyen\/[^/]+\/chuong\/[^/]+$/;

export default function ChromeToanSite({
  header,
  dieuHuong,
  children,
}: {
  header: ReactNode;
  dieuHuong: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const laTrangDocChuong = MAU_TRANG_DOC_CHUONG.test(pathname ?? '');

  if (laTrangDocChuong) {
    return <>{children}</>;
  }

  return (
    <>
      {dieuHuong}
      {header}
      <div className="pb-16 md:pb-0">{children}</div>
    </>
  );
}
