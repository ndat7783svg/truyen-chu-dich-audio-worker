import type { SVGProps } from 'react';

// Bộ icon nét (stroke) dùng chung toàn site - thay cho các đoạn <svg> chép lặp lại ở nhiều file.
type TenIcon =
  | 'mat'
  | 'sach'
  | 'khoa'
  | 'danh-dau'
  | 'tim-kiem'
  | 'nha'
  | 'nguoi'
  | 'tu-sach'
  | 'trai'
  | 'phai'
  | 'danh-sach'
  | 'phat'
  | 'lua'
  | 'dong-ho'
  | 'the-loai'
  | 'dong';

const DUONG_VE: Record<TenIcon, string[]> = {
  mat: [
    'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  ],
  sach: ['M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2V5z', 'M20 5a2 2 0 00-2-2h-5v18h5a2 2 0 002-2V5z'],
  khoa: ['M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z', 'M8 11V7a4 4 0 118 0v4'],
  'danh-dau': ['M6 3a1 1 0 00-1 1v16l7-4 7 4V4a1 1 0 00-1-1H6z'],
  'tim-kiem': ['M21 21l-4.35-4.35', 'M11 18a7 7 0 100-14 7 7 0 000 14z'],
  nha: ['M3 11l9-7 9 7', 'M5 10v10h5v-6h4v6h5V10'],
  nguoi: ['M16 7a4 4 0 11-8 0 4 4 0 018 0z', 'M5 21a7 7 0 0114 0'],
  'tu-sach': ['M4 4h4v16H4z', 'M10 4h4v16h-4z', 'M16.5 4.5l3.8 1-3.9 15-3.8-1z'],
  trai: ['M15 18l-6-6 6-6'],
  phai: ['M9 18l6-6-6-6'],
  'danh-sach': ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  phat: ['M7 4.5v15l12-7.5z'],
  lua: [
    'M12 3c.5 3.5 4 5.5 4 10a4 4 0 01-8 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1.5-5.5 0-8.5z',
  ],
  'dong-ho': ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 7v5l3 2'],
  'the-loai': ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  dong: ['M6 6l12 12', 'M18 6L6 18'],
};

export default function BieuTuong({
  ten,
  className = 'w-5 h-5',
  dac = false,
  ...props
}: { ten: TenIcon; dac?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={dac ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {DUONG_VE[ten].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
