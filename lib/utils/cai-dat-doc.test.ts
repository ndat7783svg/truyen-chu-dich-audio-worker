import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAI_DAT_MAC_DINH,
  chuanHoaCaiDatDoc,
  docCaiDatDoc,
  ghiCaiDatDoc,
  mauSacTheo,
} from './cai-dat-doc';

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

describe('chuanHoaCaiDatDoc', () => {
  it('trả về mặc định khi input không phải object', () => {
    expect(chuanHoaCaiDatDoc(null)).toEqual(CAI_DAT_MAC_DINH);
    expect(chuanHoaCaiDatDoc('chuoi')).toEqual(CAI_DAT_MAC_DINH);
  });

  it('trả về mặc định cho từng trường không hợp lệ, giữ nguyên trường hợp lệ', () => {
    const ketQua = chuanHoaCaiDatDoc({
      mauNen: 'toi',
      coChu: 999,
      phong: 'co-dien',
      giaiDong: -1,
    });
    expect(ketQua).toEqual({
      mauNen: 'toi',
      coChu: CAI_DAT_MAC_DINH.coChu,
      phong: 'co-dien',
      giaiDong: CAI_DAT_MAC_DINH.giaiDong,
    });
  });

  it('giữ nguyên toàn bộ khi input hợp lệ', () => {
    const hopLe = { mauNen: 'vang' as const, coChu: 24, phong: 'hien-dai' as const, giaiDong: 2 };
    expect(chuanHoaCaiDatDoc(hopLe)).toEqual(hopLe);
  });
});

describe('docCaiDatDoc / ghiCaiDatDoc', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', taoLocalStorageGia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trả về mặc định khi chưa lưu gì', () => {
    expect(docCaiDatDoc()).toEqual(CAI_DAT_MAC_DINH);
  });

  it('ghi rồi đọc lại đúng giá trị', () => {
    const caiDat = { mauNen: 'toi' as const, coChu: 20, phong: 'co-dien' as const, giaiDong: 2 };
    ghiCaiDatDoc(caiDat);
    expect(docCaiDatDoc()).toEqual(caiDat);
  });

  it('trả về mặc định khi dữ liệu lưu trữ là JSON hỏng', () => {
    localStorage.setItem('caiDatDocTruyen', '{khong-hop-le');
    expect(docCaiDatDoc()).toEqual(CAI_DAT_MAC_DINH);
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
    expect(() => docCaiDatDoc()).not.toThrow();
    expect(docCaiDatDoc()).toEqual(CAI_DAT_MAC_DINH);
    expect(() => ghiCaiDatDoc(CAI_DAT_MAC_DINH)).not.toThrow();
  });
});

describe('mauSacTheo', () => {
  it('trả đúng màu cho từng theme', () => {
    expect(mauSacTheo('sang')).toEqual({ nen: '#ffffff', chu: '#111827' });
    expect(mauSacTheo('vang')).toEqual({ nen: '#f4ecd8', chu: '#5b4636' });
    expect(mauSacTheo('toi')).toEqual({ nen: '#1a1a1a', chu: '#e5e5e5' });
  });
});
