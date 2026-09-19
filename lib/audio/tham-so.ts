import type { VeAudio } from './ve-audio';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_SO_NGUYEN = /^\d{1,16}$/;

export function docTruyenVaChuong(p: URLSearchParams): { truyenId: string; soChuong: number } | null {
  const t = p.get('t') ?? '';
  const c = p.get('c') ?? '';
  if (!REGEX_UUID.test(t) || !REGEX_SO_NGUYEN.test(c)) return null;
  const soChuong = Number(c);
  if (soChuong < 1) return null;
  return { truyenId: t, soChuong };
}

export function docChiSoDoan(p: URLSearchParams): number | null {
  const i = p.get('i') ?? '';
  return REGEX_SO_NGUYEN.test(i) ? Number(i) : null;
}

export function docVe(p: URLSearchParams): VeAudio | null {
  const h = p.get('h') ?? '';
  const m = p.get('m') ?? '';
  const k = p.get('k') ?? '';
  if (!REGEX_SO_NGUYEN.test(h) || !REGEX_SO_NGUYEN.test(m) || !/^[0-9a-f]{1,128}$/i.test(k)) return null;
  return { hetHan: Number(h), chuongToiDa: Number(m), k };
}
