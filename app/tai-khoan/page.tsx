import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import NutDangXuat from '@/components/NutDangXuat';
import ChonTheme from '@/components/ChonTheme';
import ChonGoiVip from '@/components/ChonGoiVip';

export default async function TrangTaiKhoan() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tenNguoiDung: string | null = null;
  let goiHetHan: string | null = null;
  if (user) {
    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('ten_nguoi_dung, goi_het_han')
      .eq('id', user.id)
      .maybeSingle();
    tenNguoiDung = hoSo?.ten_nguoi_dung ?? null;
    goiHetHan = hoSo?.goi_het_han ?? null;
  }

  return (
    <main className="w-full max-w-md mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Tài khoản</h1>

      <section className="border border-border bg-surface rounded-lg p-4">
        {user ? (
          <div className="space-y-3">
            <div>
              <p className="font-semibold">{tenNguoiDung ?? 'Người dùng'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">Cấp độ: Thành viên</p>
            <NutDangXuat />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground">Bạn chưa đăng nhập.</p>
            <div className="flex gap-3">
              <Link
                href="/dang-nhap"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="px-4 py-2 rounded border border-border text-sm font-medium"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        )}
      </section>

      {user && (
        <section className="border border-border bg-surface rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Gói VIP</h2>
          {conHieuLucGoi(goiHetHan) ? (
            <p className="text-sm">
              Đang có gói VIP, hiệu lực đến{' '}
              <strong>
                {new Date(goiHetHan as string).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </strong>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có gói VIP đang hiệu lực.</p>
          )}
          <ChonGoiVip />
        </section>
      )}

      <section className="border border-border bg-surface rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">Giao diện</h2>
        <ChonTheme />
      </section>

      <section className="border border-border bg-surface rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-1">Cài đặt</h2>
        <p className="text-sm text-muted-foreground">Sắp ra mắt</p>
      </section>
    </main>
  );
}
