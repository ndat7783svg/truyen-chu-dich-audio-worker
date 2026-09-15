import { describe, it, expect } from 'vitest';
import {
  tinhSoNhom,
  tinhNhomCuaChuong,
  taoDanhSachNhom,
  catChuongTheoNhom,
} from './chuong';

describe('lib/utils/chuong', () => {
  describe('tinhSoNhom', () => {
    it('trả về 0 khi tổng số chương <= 0', () => {
      expect(tinhSoNhom(0)).toBe(0);
      expect(tinhSoNhom(-5)).toBe(0);
    });

    it('trả về 1 khi số chương từ 1 đến 50', () => {
      expect(tinhSoNhom(1)).toBe(1);
      expect(tinhSoNhom(25)).toBe(1);
      expect(tinhSoNhom(50)).toBe(1);
    });

    it('trả về 2 khi số chương từ 51 đến 100', () => {
      expect(tinhSoNhom(51)).toBe(2);
      expect(tinhSoNhom(100)).toBe(2);
    });

    it('tính chính xác cho truyện 767 chương', () => {
      // 767 / 50 = 15.34 -> 16 nhóm
      expect(tinhSoNhom(767)).toBe(16);
    });
  });

  describe('tinhNhomCuaChuong', () => {
    it('trả về 0 khi chương <= 0', () => {
      expect(tinhNhomCuaChuong(0)).toBe(0);
      expect(tinhNhomCuaChuong(-1)).toBe(0);
    });

    it('trả về nhóm 0 cho chương 1 đến 50', () => {
      expect(tinhNhomCuaChuong(1)).toBe(0);
      expect(tinhNhomCuaChuong(50)).toBe(0);
    });

    it('trả về nhóm 1 cho chương 51 đến 100', () => {
      expect(tinhNhomCuaChuong(51)).toBe(1);
      expect(tinhNhomCuaChuong(100)).toBe(1);
    });

    it('trả về nhóm 15 cho chương 767', () => {
      expect(tinhNhomCuaChuong(767)).toBe(15);
    });
  });

  describe('taoDanhSachNhom', () => {
    it('trả về mảng rỗng khi 0 chương', () => {
      expect(taoDanhSachNhom(0)).toEqual([]);
    });

    it('tạo đúng danh sách nhóm cho truyện 120 chương', () => {
      const danhSach = taoDanhSachNhom(120);
      expect(danhSach).toEqual([
        { soNhom: 0, nhan: '1 - 50', tuChuong: 1, denChuong: 50 },
        { soNhom: 1, nhan: '51 - 100', tuChuong: 51, denChuong: 100 },
        { soNhom: 2, nhan: '101 - 120', tuChuong: 101, denChuong: 120 },
      ]);
    });
  });

  describe('catChuongTheoNhom', () => {
    it('trả về mảng rỗng nếu đầu vào rỗng', () => {
      expect(catChuongTheoNhom([], 0)).toEqual([]);
    });

    it('cắt đúng slice 50 phần tử', () => {
      const ds = Array.from({ length: 120 }, (_, i) => ({ soChuong: i + 1 }));
      const nhom0 = catChuongTheoNhom(ds, 0);
      expect(nhom0.length).toBe(50);
      expect(nhom0[0].soChuong).toBe(1);
      expect(nhom0[49].soChuong).toBe(50);

      const nhom1 = catChuongTheoNhom(ds, 1);
      expect(nhom1.length).toBe(50);
      expect(nhom1[0].soChuong).toBe(51);
      expect(nhom1[49].soChuong).toBe(100);

      const nhom2 = catChuongTheoNhom(ds, 2);
      expect(nhom2.length).toBe(20);
      expect(nhom2[0].soChuong).toBe(101);
      expect(nhom2[19].soChuong).toBe(120);
    });
  });
});
