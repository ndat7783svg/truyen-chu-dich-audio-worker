export type ThemeToanSite = 'sang' | 'giay' | 'toi';

export const THEME_MAC_DINH: ThemeToanSite = 'sang';

const KHOA_LUU_TRU = 'themeToanSite';

export function chuanHoaTheme(input: unknown): ThemeToanSite {
  return input === 'sang' || input === 'giay' || input === 'toi' ? input : THEME_MAC_DINH;
}

export function docTheme(): ThemeToanSite {
  try {
    const raw = localStorage.getItem(KHOA_LUU_TRU);
    return chuanHoaTheme(raw);
  } catch {
    return THEME_MAC_DINH;
  }
}

export function ghiTheme(theme: ThemeToanSite): void {
  try {
    localStorage.setItem(KHOA_LUU_TRU, theme);
  } catch {
    // localStorage không khả dụng - theme chỉ tồn tại trong phiên hiện tại
  }
}
