'use client';

import { useEffect } from 'react';
import { luuTienDoDoc } from './actions';

export default function LuuTienDo({
  truyenId,
  chuongId,
}: {
  truyenId: string;
  chuongId: string;
}) {
  useEffect(() => {
    luuTienDoDoc(truyenId, chuongId);
  }, [truyenId, chuongId]);

  return null;
}
