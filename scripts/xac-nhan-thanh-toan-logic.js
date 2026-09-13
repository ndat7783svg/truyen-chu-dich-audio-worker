export const SO_NGAY_THEO_GOI = {
  so_cap: 1,
  trung_cap: 7,
  cao_cap: 30,
};

export const TEN_GOI = {
  so_cap: 'Gói ngày',
  trung_cap: 'Gói tuần',
  cao_cap: 'Gói tháng',
};

export function tinhHanMoi(soNgay, tuLuc = new Date()) {
  return new Date(tuLuc.getTime() + soNgay * 24 * 60 * 60 * 1000);
}
