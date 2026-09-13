export type MaGoi = 'so_cap' | 'trung_cap' | 'cao_cap';

export type ThongTinGoi = {
  ma: MaGoi;
  ten: string;
  soNgay: number;
  gia: number;
};

export const SO_CHUONG_FREE = 50;

export const DANH_SACH_GOI: ThongTinGoi[] = [
  { ma: 'so_cap', ten: 'Gói ngày', soNgay: 1, gia: 6000 },
  { ma: 'trung_cap', ten: 'Gói tuần', soNgay: 7, gia: 39000 },
  { ma: 'cao_cap', ten: 'Gói tháng', soNgay: 30, gia: 162000 },
];

export function layThongTinGoi(ma: string): ThongTinGoi | null {
  return DANH_SACH_GOI.find((g) => g.ma === ma) ?? null;
}

export const THONG_TIN_NHAN_TIEN = {
  tenNguoiNhan: 'NGUYEN TIEN DAT',
  nganHang: 'MoMo',
  soTaiKhoan: 'PSP2624219600000051',
};
