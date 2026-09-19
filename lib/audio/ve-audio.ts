import { createHmac, timingSafeEqual } from 'node:crypto';

// "Vé" cho đoạn audio chương VIP: chỉ server biết bí mật nên client không tự tạo được. Vé gắn với
// truyện + chương lớn nhất được nghe + hạn dùng; route đoạn chỉ kiểm chữ ký (không gọi DB).
export type VeAudio = { chuongToiDa: number; hetHan: number; k: string };

function tinhChuKy(boMat: string, truyenId: string, chuongToiDa: number, hetHan: number): string {
  return createHmac('sha256', boMat).update(`${truyenId}|${chuongToiDa}|${hetHan}`).digest('hex');
}

export function taoVe(boMat: string, truyenId: string, chuongToiDa: number, hetHan: number): VeAudio {
  return { chuongToiDa, hetHan, k: tinhChuKy(boMat, truyenId, chuongToiDa, hetHan) };
}

export function kiemVe(
  boMat: string,
  truyenId: string,
  ve: VeAudio,
  soChuong: number,
  bayGio: number = Math.floor(Date.now() / 1000)
): boolean {
  if (ve.hetHan <= bayGio) return false;
  if (soChuong > ve.chuongToiDa) return false;
  const mong = Buffer.from(tinhChuKy(boMat, truyenId, ve.chuongToiDa, ve.hetHan), 'hex');
  const nhan = Buffer.from(ve.k, 'hex');
  if (nhan.length !== mong.length) return false;
  return timingSafeEqual(mong, nhan);
}
