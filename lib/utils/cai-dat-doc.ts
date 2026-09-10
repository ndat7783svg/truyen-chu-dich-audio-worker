export type MauNen = 'sang' | 'vang' | 'toi';
export type Phong = 'hien-dai' | 'co-dien';

export type CaiDatDoc = {
  mauNen: MauNen;
  coChu: number;
  phong: Phong;
  giaiDong: number;
};

export const CAI_DAT_MAC_DINH: CaiDatDoc = {
  mauNen: 'sang',
  coChu: 18,
  phong: 'hien-dai',
  giaiDong: 1.75,
};

export const GIOI_HAN_CO_CHU = { min: 16, max: 32 };
export const GIOI_HAN_GIAI_DONG = { min: 1.5, max: 2.5 };

const KHOA_LUU_TRU = 'caiDatDocTruyen';

export function chuanHoaCaiDatDoc(input: unknown): CaiDatDoc {
  if (typeof input !== 'object' || input === null) return CAI_DAT_MAC_DINH;
  const obj = input as Record<string, unknown>;

  const mauNen: MauNen =
    obj.mauNen === 'sang' || obj.mauNen === 'vang' || obj.mauNen === 'toi'
      ? obj.mauNen
      : CAI_DAT_MAC_DINH.mauNen;

  const phong: Phong =
    obj.phong === 'hien-dai' || obj.phong === 'co-dien' ? obj.phong : CAI_DAT_MAC_DINH.phong;

  const coChu =
    typeof obj.coChu === 'number' &&
    obj.coChu >= GIOI_HAN_CO_CHU.min &&
    obj.coChu <= GIOI_HAN_CO_CHU.max
      ? obj.coChu
      : CAI_DAT_MAC_DINH.coChu;

  const giaiDong =
    typeof obj.giaiDong === 'number' &&
    obj.giaiDong >= GIOI_HAN_GIAI_DONG.min &&
    obj.giaiDong <= GIOI_HAN_GIAI_DONG.max
      ? obj.giaiDong
      : CAI_DAT_MAC_DINH.giaiDong;

  return { mauNen, coChu, phong, giaiDong };
}

export function docCaiDatDoc(): CaiDatDoc {
  try {
    const raw = localStorage.getItem(KHOA_LUU_TRU);
    if (!raw) return CAI_DAT_MAC_DINH;
    return chuanHoaCaiDatDoc(JSON.parse(raw));
  } catch {
    return CAI_DAT_MAC_DINH;
  }
}

export function ghiCaiDatDoc(caiDat: CaiDatDoc): void {
  try {
    localStorage.setItem(KHOA_LUU_TRU, JSON.stringify(caiDat));
  } catch {
    // localStorage không khả dụng - cài đặt chỉ tồn tại trong phiên hiện tại
  }
}

export function mauSacTheo(mauNen: MauNen): { nen: string; chu: string } {
  switch (mauNen) {
    case 'vang':
      return { nen: '#f4ecd8', chu: '#5b4636' };
    case 'toi':
      return { nen: '#1a1a1a', chu: '#e5e5e5' };
    case 'sang':
    default:
      return { nen: '#ffffff', chu: '#111827' };
  }
}
