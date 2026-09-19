import { describe, it, expect } from 'vitest';
import { taoVe, kiemVe } from './ve-audio';

const BI_MAT = 'bi-mat-thu-nghiem';
const TRUYEN = '11111111-1111-4111-8111-111111111111';
const BAY_GIO = 1_800_000_000;

describe('ve audio', () => {
  it('vé hợp lệ, chương trong phạm vi -> true', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 55, BAY_GIO)).toBe(true);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 60, BAY_GIO)).toBe(true);
  });

  it('chương vượt chuongToiDa -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 61, BAY_GIO)).toBe(false);
  });

  it('vé hết hạn -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO - 1);
    expect(kiemVe(BI_MAT, TRUYEN, ve, 55, BAY_GIO)).toBe(false);
  });

  it('sai bí mật hoặc sai truyện -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe('bi-mat-khac', TRUYEN, ve, 55, BAY_GIO)).toBe(false);
    expect(kiemVe(BI_MAT, '22222222-2222-4222-8222-222222222222', ve, 55, BAY_GIO)).toBe(false);
  });

  it('sửa chuongToiDa hoặc hetHan (giả mạo) -> false', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, chuongToiDa: 999 }, 500, BAY_GIO)).toBe(false);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, hetHan: BAY_GIO + 999999 }, 55, BAY_GIO)).toBe(false);
  });

  it('chữ ký sai định dạng/độ dài -> false, không ném lỗi', () => {
    const ve = taoVe(BI_MAT, TRUYEN, 60, BAY_GIO + 3600);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, k: 'abc' }, 55, BAY_GIO)).toBe(false);
    expect(kiemVe(BI_MAT, TRUYEN, { ...ve, k: '' }, 55, BAY_GIO)).toBe(false);
  });
});
