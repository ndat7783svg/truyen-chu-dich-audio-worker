import { describe, it, expect } from 'vitest';
import { docTruyenVaChuong, docChiSoDoan, docVe } from './tham-so';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('docTruyenVaChuong', () => {
  it('hợp lệ', () => {
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=12`))).toEqual({ truyenId: UUID, soChuong: 12 });
  });
  it('thiếu / sai uuid / chương không phải số nguyên dương -> null', () => {
    expect(docTruyenVaChuong(new URLSearchParams('c=12'))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams('t=abc&c=12'))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=0`))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=1.5`))).toBeNull();
    expect(docTruyenVaChuong(new URLSearchParams(`t=${UUID}&c=abc`))).toBeNull();
  });
});

describe('docChiSoDoan', () => {
  it('số nguyên >= 0', () => {
    expect(docChiSoDoan(new URLSearchParams('i=0'))).toBe(0);
    expect(docChiSoDoan(new URLSearchParams('i=37'))).toBe(37);
  });
  it('âm / thiếu / không phải số -> null', () => {
    expect(docChiSoDoan(new URLSearchParams('i=-1'))).toBeNull();
    expect(docChiSoDoan(new URLSearchParams(''))).toBeNull();
    expect(docChiSoDoan(new URLSearchParams('i=x'))).toBeNull();
  });
});

describe('docVe', () => {
  it('đủ h, m, k -> trả vé', () => {
    expect(docVe(new URLSearchParams('h=1800000000&m=60&k=abcdef12'))).toEqual({
      hetHan: 1800000000,
      chuongToiDa: 60,
      k: 'abcdef12',
    });
  });
  it('thiếu trường hoặc k không phải hex -> null', () => {
    expect(docVe(new URLSearchParams('h=1&m=60'))).toBeNull();
    expect(docVe(new URLSearchParams('h=1&m=60&k=zzzz'))).toBeNull();
  });
});
