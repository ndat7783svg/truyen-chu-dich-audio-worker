import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAI_DAT_AUDIO_MAC_DINH,
  GIOI_HAN_TOC_DO,
  chuanHoaCaiDatAudio,
  docCaiDatAudio,
  ghiCaiDatAudio,
  taoDoanDoc,
} from './cai-dat-audio';

function taoLocalStorageGia() {
  const luuTru = new Map<string, string>();
  return {
    getItem: (key: string) => luuTru.get(key) ?? null,
    setItem: (key: string, value: string) => {
      luuTru.set(key, value);
    },
    removeItem: (key: string) => {
      luuTru.delete(key);
    },
    clear: () => {
      luuTru.clear();
    },
  };
}

describe('chuanHoaCaiDatAudio', () => {
  it('trả về mặc định khi input không phải object', () => {
    expect(chuanHoaCaiDatAudio(null)).toEqual(CAI_DAT_AUDIO_MAC_DINH);
    expect(chuanHoaCaiDatAudio('chuoi')).toEqual(CAI_DAT_AUDIO_MAC_DINH);
  });

  it('trả về mặc định khi tocDo ngoài giới hạn', () => {
    expect(chuanHoaCaiDatAudio({ tocDo: 5 })).toEqual(CAI_DAT_AUDIO_MAC_DINH);
    expect(chuanHoaCaiDatAudio({ tocDo: 0.1 })).toEqual(CAI_DAT_AUDIO_MAC_DINH);
  });

  it('giữ nguyên khi tocDo hợp lệ', () => {
    expect(chuanHoaCaiDatAudio({ tocDo: 1.25 })).toEqual({ tocDo: 1.25 });
    expect(chuanHoaCaiDatAudio({ tocDo: GIOI_HAN_TOC_DO.min })).toEqual({
      tocDo: GIOI_HAN_TOC_DO.min,
    });
    expect(chuanHoaCaiDatAudio({ tocDo: GIOI_HAN_TOC_DO.max })).toEqual({
      tocDo: GIOI_HAN_TOC_DO.max,
    });
  });
});

describe('docCaiDatAudio / ghiCaiDatAudio', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', taoLocalStorageGia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trả về mặc định khi chưa lưu gì', () => {
    expect(docCaiDatAudio()).toEqual(CAI_DAT_AUDIO_MAC_DINH);
  });

  it('ghi rồi đọc lại đúng giá trị', () => {
    ghiCaiDatAudio({ tocDo: 1.5 });
    expect(docCaiDatAudio()).toEqual({ tocDo: 1.5 });
  });

  it('trả về mặc định khi dữ liệu lưu trữ là JSON hỏng', () => {
    localStorage.setItem('caiDatAudioTruyen', '{khong-hop-le');
    expect(docCaiDatAudio()).toEqual(CAI_DAT_AUDIO_MAC_DINH);
  });

  it('không throw khi localStorage báo lỗi', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bị chặn');
      },
      setItem: () => {
        throw new Error('bị chặn');
      },
    });
    expect(() => docCaiDatAudio()).not.toThrow();
    expect(docCaiDatAudio()).toEqual(CAI_DAT_AUDIO_MAC_DINH);
    expect(() => ghiCaiDatAudio(CAI_DAT_AUDIO_MAC_DINH)).not.toThrow();
  });
});

describe('taoDoanDoc', () => {
  it('trả về mảng rỗng khi nội dung rỗng', () => {
    expect(taoDoanDoc('')).toEqual([]);
    expect(taoDoanDoc('   \n\n  ')).toEqual([]);
  });

  it('tách theo dòng trống, bỏ khoảng trắng thừa', () => {
    expect(taoDoanDoc('Đoạn một.\n\nĐoạn hai.\n\n\nĐoạn ba.')).toEqual([
      'Đoạn một.',
      'Đoạn hai.',
      'Đoạn ba.',
    ]);
  });

  it('giữ nguyên đoạn ngắn dưới ngưỡng, không tách nhỏ thêm', () => {
    const doan = 'Câu một. Câu hai. Câu ba.';
    expect(taoDoanDoc(doan)).toEqual([doan]);
  });

  it('tách đoạn dài thành nhiều câu theo dấu câu, mỗi mẩu không vượt ngưỡng', () => {
    const cau = 'Đây là một câu ví dụ có độ dài vừa phải để lặp lại nhiều lần cho đủ dài.';
    const doanDai = new Array(10).fill(cau).join(' ');
    const ketQua = taoDoanDoc(doanDai);
    expect(ketQua.length).toBeGreaterThan(1);
    for (const mau of ketQua) {
      expect(mau.length).toBeLessThanOrEqual(220);
    }
    // Ghép lại phải giữ nguyên nội dung (không mất câu nào)
    expect(ketQua.join(' ')).toBe(doanDai);
  });
});
