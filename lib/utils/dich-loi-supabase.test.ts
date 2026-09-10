import { describe, it, expect } from 'vitest';
import { dichLoiSupabase } from './dich-loi-supabase';

describe('dichLoiSupabase', () => {
  it('dịch lỗi Invalid login credentials thành tiếng Việt', () => {
    expect(dichLoiSupabase('Invalid login credentials')).toBe('Email hoặc mật khẩu không đúng.');
  });

  it('dịch lỗi Email not confirmed thành tiếng Việt', () => {
    expect(dichLoiSupabase('Email not confirmed')).toBe(
      'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản.'
    );
  });

  it('dịch lỗi User already registered thành tiếng Việt', () => {
    expect(dichLoiSupabase('User already registered')).toBe('Email này đã được đăng ký.');
  });

  it('trả về câu thông báo chung khi gặp lỗi lạ không có trong danh sách map', () => {
    expect(dichLoiSupabase('Some unknown network error')).toBe('Có lỗi xảy ra, vui lòng thử lại.');
    expect(dichLoiSupabase('')).toBe('Có lỗi xảy ra, vui lòng thử lại.');
  });
});
