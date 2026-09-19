import type { VeAudio } from './ve-audio';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_SO_NGUYEN = /^\d{1,16}$/;

// Chặn giá trị phi lý sớm (vd c=99999999999 làm Postgres integer tràn -> 500 thay vì 400).
const SO_TOI_DA_CHUONG = 1_000_000;
const SO_TOI_DA_DOAN = 100_000;

export function docTruyenVaChuong(p: URLSearchParams): { truyenId: string; soChuong: number } | null {
  const t = p.get('t') ?? '';
  const c = p.get('c') ?? '';
  if (!REGEX_UUID.test(t) || !REGEX_SO_NGUYEN.test(c)) return null;
  const soChuong = Number(c);
  if (soChuong < 1 || soChuong > SO_TOI_DA_CHUONG) return null;
  return { truyenId: t, soChuong };
}

export function docChiSoDoan(p: URLSearchParams): number | null {
  const i = p.get('i') ?? '';
  if (!REGEX_SO_NGUYEN.test(i)) return null;
  const chiSo = Number(i);
  return chiSo <= SO_TOI_DA_DOAN ? chiSo : null;
}

export function docVe(p: URLSearchParams): VeAudio | null {
  const h = p.get('h') ?? '';
  const m = p.get('m') ?? '';
  const k = p.get('k') ?? '';
  if (!REGEX_SO_NGUYEN.test(h) || !REGEX_SO_NGUYEN.test(m) || !/^[0-9a-f]{1,128}$/i.test(k)) return null;
  return { hetHan: Number(h), chuongToiDa: Number(m), k };
}
