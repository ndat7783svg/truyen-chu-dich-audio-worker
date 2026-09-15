import { describe, it, expect } from 'vitest';
import { layIpTuHeader, ipTrongDaiCidr, ipTrongDanhSach } from './xac-minh-bot';

describe('layIpTuHeader', () => {
  it('lay IP dau tien khi header co nhieu IP phan cach boi dau phay', () => {
    expect(layIpTuHeader('1.2.3.4, 5.6.7.8')).toBe('1.2.3.4');
  });

  it('trim khoang trang quanh IP', () => {
    expect(layIpTuHeader('  1.2.3.4  ,5.6.7.8')).toBe('1.2.3.4');
  });

  it('header null tra null', () => {
    expect(layIpTuHeader(null)).toBeNull();
  });

  it('header rong tra null', () => {
    expect(layIpTuHeader('')).toBeNull();
  });
});

describe('ipTrongDaiCidr', () => {
  it('khop khi IP nam trong dai /24', () => {
    expect(ipTrongDaiCidr('192.168.1.5', '192.168.1.0/24')).toBe(true);
  });

  it('khong khop khi IP ngoai dai /24', () => {
    expect(ipTrongDaiCidr('192.168.2.5', '192.168.1.0/24')).toBe(false);
  });

  it('khop /32 (1 IP duy nhat)', () => {
    expect(ipTrongDaiCidr('10.0.0.1', '10.0.0.1/32')).toBe(true);
    expect(ipTrongDaiCidr('10.0.0.2', '10.0.0.1/32')).toBe(false);
  });

  it('/0 khop moi IP', () => {
    expect(ipTrongDaiCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
  });

  it('CIDR khong hop le tra false', () => {
    expect(ipTrongDaiCidr('1.2.3.4', 'khong-phai-cidr')).toBe(false);
  });

  it('IP khong hop le tra false', () => {
    expect(ipTrongDaiCidr('999.1.1.1', '1.2.3.0/24')).toBe(false);
  });
});

describe('ipTrongDanhSach', () => {
  it('true neu khop it nhat 1 CIDR trong danh sach', () => {
    expect(ipTrongDanhSach('192.168.1.5', ['10.0.0.0/8', '192.168.1.0/24'])).toBe(true);
  });

  it('false neu khong khop CIDR nao', () => {
    expect(ipTrongDanhSach('192.168.1.5', ['10.0.0.0/8'])).toBe(false);
  });

  it('false neu danh sach rong', () => {
    expect(ipTrongDanhSach('192.168.1.5', [])).toBe(false);
  });
});
