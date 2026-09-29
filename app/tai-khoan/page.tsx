import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import NutDangXuat from '@/components/NutDangXuat';
import ChonTheme from '@/components/ChonTheme';
import ChonGoiVip from '@/components/ChonGoiVip';
import BieuTuong from '@/components/BieuTuong';

function TheMuc({ tieuDe, children }: { tieuDe: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{tieuDe}</h2>
      {children}
    </section>
  );
}

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
  const coVip = conHieuLucGoi(goiHetHan);
  const tenHienThi = tenNguoiDung ?? 'Người dùng';

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-5">
      <h1 className="text-2xl font-bold">Tài khoản</h1>

      <section className="rounded-2xl border border-border bg-card p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-bold text-accent">
              {tenHienThi.trim().charAt(0).toUpperCase() || 'N'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">
                <span className="truncate">{tenHienThi}</span>
                {coVip && (
                  <span className="shrink-0 rounded bg-rank px-1.5 py-0.5 text-[10px] font-bold text-white">
                    VIP
                  </span>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted-foreground">
              <BieuTuong ten="nguoi" />
            </div>
            <p className="text-muted-foreground">
              Đăng nhập để lưu truyện, đọc tiếp chương đang dở và mua gói VIP.
            </p>
            <div className="flex gap-2">
              <Link
                href="/dang-nhap"
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        )}
      </section>

      {user && (
        <TheMuc tieuDe="Gói VIP">
          <div className="space-y-3">
            {coVip ? (
              <p className="text-sm">
                Đang có gói VIP, hiệu lực đến{' '}
                <strong>
                  {new Date(goiHetHan as string).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
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
          </div>
        </TheMuc>
      )}

      <TheMuc tieuDe="Giao diện">
        <ChonTheme />
      </TheMuc>

      {user && (
        <div className="pt-2 text-center">
          <NutDangXuat />
        </div>
      )}
    </main>
  );
}
