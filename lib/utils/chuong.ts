export const KICH_THUOC_NHOM_CHUONG = 50;

export type NhomChuongInfo = {
  soNhom: number;
  nhan: string;
  tuChuong: number;
  denChuong: number;
};

/**
 * Tính tổng số nhóm 50 chương dựa vào tổng số chương.
 * Ví dụ: 0 chương -> 0 nhóm; 1-50 chương -> 1 nhóm; 51-100 -> 2 nhóm; 767 chương -> 16 nhóm.
 */
export function tinhSoNhom(tongSoChuong: number, kichThuoc = KICH_THUOC_NHOM_CHUONG): number {
  if (tongSoChuong <= 0) return 0;
  return Math.ceil(tongSoChuong / kichThuoc);
}

/**
 * Tính số nhóm (0-indexed) của một số chương cụ thể.
 * Ví dụ: Chương 1..50 -> 0; Chương 51..100 -> 1; Chương 767 -> 15.
 */
export function tinhNhomCuaChuong(soChuong: number, kichThuoc = KICH_THUOC_NHOM_CHUONG): number {
  if (soChuong <= 0) return 0;
  return Math.floor((soChuong - 1) / kichThuoc);
}

/**
 * Sinh danh sách thông tin các nhóm chương (nhãn, khoảng bắt đầu, khoảng kết thúc).
 */
export function taoDanhSachNhom(
  tongSoChuong: number,
  kichThuoc = KICH_THUOC_NHOM_CHUONG
): NhomChuongInfo[] {
  const soNhom = tinhSoNhom(tongSoChuong, kichThuoc);
  const danhSach: NhomChuongInfo[] = [];

  for (let i = 0; i < soNhom; i++) {
    const tuChuong = i * kichThuoc + 1;
    const denChuong = Math.min((i + 1) * kichThuoc, tongSoChuong);
    danhSach.push({
      soNhom: i,
      nhan: `${tuChuong} - ${denChuong}`,
      tuChuong,
      denChuong,
    });
  }

  return danhSach;
}

/**
 * Cắt mảng chương theo chỉ số nhóm (0-indexed) cho Client Component.
 */
export function catChuongTheoNhom<T>(
  dsChuong: T[],
  soNhom: number,
  kichThuoc = KICH_THUOC_NHOM_CHUONG
): T[] {
  if (!dsChuong || dsChuong.length === 0) return [];
  const batDau = soNhom * kichThuoc;
  const ketThuc = batDau + kichThuoc;
  return dsChuong.slice(batDau, ketThuc);
}
