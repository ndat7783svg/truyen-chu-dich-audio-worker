export type CaiDatAudio = {
  tocDo: number;
};

export const CAI_DAT_AUDIO_MAC_DINH: CaiDatAudio = {
  tocDo: 1,
};

export const GIOI_HAN_TOC_DO = { min: 0.75, max: 1.5 };

const KHOA_LUU_TRU = 'caiDatAudioTruyen';

const NGUONG_KY_TU_MOT_DOAN = 200;

export function chuanHoaCaiDatAudio(input: unknown): CaiDatAudio {
  if (typeof input !== 'object' || input === null) return CAI_DAT_AUDIO_MAC_DINH;
  const obj = input as Record<string, unknown>;

  const tocDo =
    typeof obj.tocDo === 'number' && obj.tocDo >= GIOI_HAN_TOC_DO.min && obj.tocDo <= GIOI_HAN_TOC_DO.max
      ? obj.tocDo
      : CAI_DAT_AUDIO_MAC_DINH.tocDo;

  return { tocDo };
}

export function docCaiDatAudio(): CaiDatAudio {
  try {
    const raw = localStorage.getItem(KHOA_LUU_TRU);
    if (!raw) return CAI_DAT_AUDIO_MAC_DINH;
    return chuanHoaCaiDatAudio(JSON.parse(raw));
  } catch {
    return CAI_DAT_AUDIO_MAC_DINH;
  }
}

export function ghiCaiDatAudio(caiDat: CaiDatAudio): void {
  try {
    localStorage.setItem(KHOA_LUU_TRU, JSON.stringify(caiDat));
  } catch {
    // localStorage không khả dụng - cài đặt chỉ tồn tại trong phiên hiện tại
  }
}

/**
 * Chia nội dung chương thành các mẩu ngắn để đọc bằng SpeechSynthesis.
 * Trình duyệt (đặc biệt Chrome) hay treo/dừng giữa chừng khi 1 utterance quá dài,
 * nên tách theo đoạn (dòng trống) rồi tách tiếp theo câu nếu đoạn còn dài.
 */
export function taoDoanDoc(noiDung: string): string[] {
  const doanVan = noiDung
    .split(/\n+/)
    .map((doan) => doan.trim())
    .filter((doan) => doan.length > 0);

  const ketQua: string[] = [];

  for (const doan of doanVan) {
    if (doan.length <= NGUONG_KY_TU_MOT_DOAN) {
      ketQua.push(doan);
      continue;
    }

    const cauList = doan.split(/(?<=[.!?…])\s+/).filter((cau) => cau.length > 0);
    let gomHien = '';

    for (const cau of cauList) {
      const ghep = gomHien ? `${gomHien} ${cau}` : cau;
      if (ghep.length > NGUONG_KY_TU_MOT_DOAN && gomHien) {
        ketQua.push(gomHien);
        gomHien = cau;
      } else {
        gomHien = ghep;
      }
    }

    if (gomHien) ketQua.push(gomHien);
  }

  return ketQua;
}
