import { describe, it, expect } from 'vitest';
import { laySoChuongTuTieuDe, kiemTraTinhLienTuc } from './kiem-tra-chuong.js';

describe('laySoChuongTuTieuDe', () => {
  it('lay dung so chuong tu dong tieu de chuan', () => {
    expect(laySoChuongTuTieuDe('# Chương 501: Ten chuong')).toBe(501);
  });

  it('tra ve null neu dong tieu de khong co so chuong', () => {
    expect(laySoChuongTuTieuDe('# Loi mo dau')).toBeNull();
  });
});

describe('kiemTraTinhLienTuc', () => {
  it('khong bao thieu chuong nao khi day du lien tuc', () => {
    const kq = kiemTraTinhLienTuc([
      { soChuongFile: 1, soChuongTieuDe: 1 },
      { soChuongFile: 2, soChuongTieuDe: 2 },
      { soChuongFile: 3, soChuongTieuDe: 3 },
    ]);
    expect(kq.thieu).toEqual([]);
  });

  it('phat hien dung cac so chuong bi thieu trong khoang', () => {
    const kq = kiemTraTinhLienTuc([
      { soChuongFile: 501, soChuongTieuDe: 501 },
      { soChuongFile: 503, soChuongTieuDe: 503 },
      { soChuongFile: 505, soChuongTieuDe: 505 },
    ]);
    expect(kq.thieu).toEqual([502, 504]);
  });

  it('phat hien lech so chuong giua ten file va tieu de trong noi dung', () => {
    const kq = kiemTraTinhLienTuc([
      { soChuongFile: 501, soChuongTieuDe: 501 },
      { soChuongFile: 502, soChuongTieuDe: 501 },
    ]);
    expect(kq.lechTieuDe).toEqual([{ soChuongFile: 502, soChuongTieuDe: 501 }]);
  });

  it('bo qua kiem tra lech neu tieu de khong doc duoc so chuong (null)', () => {
    const kq = kiemTraTinhLienTuc([{ soChuongFile: 501, soChuongTieuDe: null }]);
    expect(kq.lechTieuDe).toEqual([]);
  });

  it('tra ve mang rong va min/max null khi danh sach rong', () => {
    const kq = kiemTraTinhLienTuc([]);
    expect(kq).toEqual({ thieu: [], lechTieuDe: [], tongSo: 0, min: null, max: null });
  });
});
