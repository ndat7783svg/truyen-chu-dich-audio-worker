import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chuanHoaTheme, docTheme, ghiTheme, THEME_MAC_DINH } from './theme';

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

describe('chuanHoaTheme', () => {
  it('chấp nhận giá trị hợp lệ', () => {
    expect(chuanHoaTheme('sang')).toBe('sang');
    expect(chuanHoaTheme('giay')).toBe('giay');
    expect(chuanHoaTheme('toi')).toBe('toi');
  });

  it('trả về mặc định khi giá trị không hợp lệ', () => {
    expect(chuanHoaTheme('xyz')).toBe(THEME_MAC_DINH);
    expect(chuanHoaTheme(null)).toBe(THEME_MAC_DINH);
    expect(chuanHoaTheme(undefined)).toBe(THEME_MAC_DINH);
    expect(chuanHoaTheme(123)).toBe(THEME_MAC_DINH);
  });
});

describe('docTheme / ghiTheme', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', taoLocalStorageGia());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trả về mặc định khi chưa lưu gì', () => {
    expect(docTheme()).toBe(THEME_MAC_DINH);
  });

  it('ghi rồi đọc lại đúng giá trị', () => {
    ghiTheme('toi');
    expect(docTheme()).toBe('toi');
    ghiTheme('giay');
    expect(docTheme()).toBe('giay');
  });

  it('đọc dữ liệu hỏng trả về mặc định', () => {
    localStorage.setItem('themeToanSite', 'gia-tri-la');
    expect(docTheme()).toBe(THEME_MAC_DINH);
  });
});
