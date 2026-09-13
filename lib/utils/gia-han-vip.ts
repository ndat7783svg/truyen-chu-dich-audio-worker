export function tinhHanMoi(soNgay: number, tuLuc: Date = new Date()): Date {
  return new Date(tuLuc.getTime() + soNgay * 24 * 60 * 60 * 1000);
}

export function conHieuLucGoi(goiHetHan: string | null, hienTai: Date = new Date()): boolean {
  if (!goiHetHan) return false;
  return new Date(goiHetHan).getTime() > hienTai.getTime();
}

const KY_TU_MA_GIAO_DICH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function sinhMaGiaoDich(): string {
  let ma = '';
  for (let i = 0; i < 6; i += 1) {
    ma += KY_TU_MA_GIAO_DICH[Math.floor(Math.random() * KY_TU_MA_GIAO_DICH.length)];
  }
  return `VIP-${ma}`;
}
