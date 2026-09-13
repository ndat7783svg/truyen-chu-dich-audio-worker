import { describe, it, expect } from 'vitest';
import { tinhHanMoi, conHieuLucGoi, sinhMaGiaoDich } from './gia-han-vip';

describe('tinhHanMoi', () => {
  it('cong dung so ngay vao thoi diem cho truoc', () => {
    const tuLuc = new Date('2026-09-13T10:00:00.000Z');
    expect(tinhHanMoi(7, tuLuc).toISOString()).toBe('2026-09-20T10:00:00.000Z');
  });

  it('mac dinh tinh tu thoi diem hien tai neu khong truyen tuLuc', () => {
    const truoc = Date.now();
    const ketQua = tinhHanMoi(1);
    const sau = Date.now();
    const mot_ngay = 24 * 60 * 60 * 1000;
    expect(ketQua.getTime()).toBeGreaterThanOrEqual(truoc + mot_ngay);
    expect(ketQua.getTime()).toBeLessThanOrEqual(sau + mot_ngay);
  });
});

describe('conHieuLucGoi', () => {
  it('tra ve false neu chua co goi (null)', () => {
    expect(conHieuLucGoi(null)).toBe(false);
  });

  it('tra ve false neu da het han', () => {
    const hienTai = new Date('2026-09-13T10:00:00.000Z');
    expect(conHieuLucGoi('2026-09-12T10:00:00.000Z', hienTai)).toBe(false);
  });

  it('tra ve true neu con hieu luc', () => {
    const hienTai = new Date('2026-09-13T10:00:00.000Z');
    expect(conHieuLucGoi('2026-09-14T10:00:00.000Z', hienTai)).toBe(true);
  });
});

describe('sinhMaGiaoDich', () => {
  it('sinh dung dinh dang VIP-XXXXXX', () => {
    expect(sinhMaGiaoDich()).toMatch(/^VIP-[A-Z0-9]{6}$/);
  });

  it('sinh 2 lan cho ra 2 ma khac nhau (xac suat trung cuc thap)', () => {
    expect(sinhMaGiaoDich()).not.toBe(sinhMaGiaoDich());
  });
});
