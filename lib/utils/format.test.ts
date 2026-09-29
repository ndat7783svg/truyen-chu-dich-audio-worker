import { describe, it, expect } from 'vitest';
import { dinhDangSoRutGon, thoiGianTruoc } from './format';

describe('dinhDangSoRutGon', () => {
  it('xử lý giá trị null, undefined hoặc số âm', () => {
    expect(dinhDangSoRutGon(null)).toBe('0');
    expect(dinhDangSoRutGon(undefined)).toBe('0');
    expect(dinhDangSoRutGon(-5)).toBe('0');
  });

  it('giữ nguyên định dạng số dưới 1.000', () => {
    expect(dinhDangSoRutGon(0)).toBe('0');
    expect(dinhDangSoRutGon(50)).toBe('50');
    expect(dinhDangSoRutGon(842)).toBe('842');
    expect(dinhDangSoRutGon(999)).toBe('999');
  });

  it('rút gọn số từ 1.000 đến dưới 1.000.000 dạng K', () => {
    expect(dinhDangSoRutGon(1000)).toBe('1K');
    expect(dinhDangSoRutGon(1050)).toBe('1.1K');
    expect(dinhDangSoRutGon(1200)).toBe('1.2K');
    expect(dinhDangSoRutGon(12000)).toBe('12K');
    expect(dinhDangSoRutGon(12500)).toBe('12.5K');
    expect(dinhDangSoRutGon(15400)).toBe('15.4K');
    expect(dinhDangSoRutGon(999900)).toBe('999.9K');
  });

  it('rút gọn số từ 1.000.000 trở lên dạng M', () => {
    expect(dinhDangSoRutGon(1000000)).toBe('1M');
    expect(dinhDangSoRutGon(1200000)).toBe('1.2M');
    expect(dinhDangSoRutGon(3400000)).toBe('3.4M');
    expect(dinhDangSoRutGon(10500000)).toBe('10.5M');
  });
});

describe('thoiGianTruoc', () => {
  const bayGio = Date.parse('2026-09-29T12:00:00Z');
  const truoc = (giay: number) => new Date(bayGio - giay * 1000).toISOString();

  it('trả chuỗi rỗng khi thiếu mốc hoặc mốc không hợp lệ', () => {
    expect(thoiGianTruoc(null, bayGio)).toBe('');
    expect(thoiGianTruoc('khong-phai-ngay', bayGio)).toBe('');
  });

  it('dưới 1 phút và mốc tương lai (lệch đồng hồ) đều là "vừa xong"', () => {
    expect(thoiGianTruoc(truoc(30), bayGio)).toBe('vừa xong');
    expect(thoiGianTruoc(truoc(-120), bayGio)).toBe('vừa xong');
  });

  it('đổi đúng đơn vị phút/giờ/ngày/tháng/năm', () => {
    expect(thoiGianTruoc(truoc(5 * 60), bayGio)).toBe('5 phút trước');
    expect(thoiGianTruoc(truoc(3 * 3600), bayGio)).toBe('3 giờ trước');
    expect(thoiGianTruoc(truoc(2 * 86400), bayGio)).toBe('2 ngày trước');
    expect(thoiGianTruoc(truoc(65 * 86400), bayGio)).toBe('2 tháng trước');
    expect(thoiGianTruoc(truoc(400 * 86400), bayGio)).toBe('1 năm trước');
  });
});
