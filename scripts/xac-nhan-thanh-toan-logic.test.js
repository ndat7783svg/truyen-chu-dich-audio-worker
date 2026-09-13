import { describe, it, expect } from 'vitest';
import { tinhHanMoi, SO_NGAY_THEO_GOI, TEN_GOI } from './xac-nhan-thanh-toan-logic.js';

describe('tinhHanMoi', () => {
  it('cong dung so ngay vao thoi diem cho truoc', () => {
    const tuLuc = new Date('2026-09-13T10:00:00.000Z');
    expect(tinhHanMoi(30, tuLuc).toISOString()).toBe('2026-10-13T10:00:00.000Z');
  });
});

describe('SO_NGAY_THEO_GOI', () => {
  it('co dung so ngay cho ca 3 goi', () => {
    expect(SO_NGAY_THEO_GOI.so_cap).toBe(1);
    expect(SO_NGAY_THEO_GOI.trung_cap).toBe(7);
    expect(SO_NGAY_THEO_GOI.cao_cap).toBe(30);
  });
});

describe('TEN_GOI', () => {
  it('co ten hien thi cho ca 3 goi', () => {
    expect(TEN_GOI.so_cap).toBeTruthy();
    expect(TEN_GOI.trung_cap).toBeTruthy();
    expect(TEN_GOI.cao_cap).toBeTruthy();
  });
});
