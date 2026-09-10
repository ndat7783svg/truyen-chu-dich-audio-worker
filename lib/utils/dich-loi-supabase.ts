export function dichLoiSupabase(message: string): string {
  if (!message) {
    return 'Có lỗi xảy ra, vui lòng thử lại.';
  }

  const msg = message.toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản.';
  }

  if (msg.includes('user already registered')) {
    return 'Email này đã được đăng ký.';
  }

  return 'Có lỗi xảy ra, vui lòng thử lại.';
}
