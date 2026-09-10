import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import NutDangXuat from './NutDangXuat';
import DropdownTheLoai from './DropdownTheLoai';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tenNguoiDung: string | null = null;
  if (user) {
    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('ten_nguoi_dung')
      .eq('id', user.id)
      .maybeSingle();

    tenNguoiDung = hoSo?.ten_nguoi_dung ?? null;
  }

  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="w-full max-w-3xl mx-auto p-4 flex justify-between items-center">
      <Link href="/" className="font-bold">
        Truyện dịch AI
      </Link>
      <nav className="flex items-center gap-4">
        <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-700">
                Xin chào{tenNguoiDung ? `, ${tenNguoiDung}` : ''}
              </span>
              <NutDangXuat />
            </>
          ) : (
            <>
              <Link href="/dang-nhap" className="hover:underline">
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="hover:underline">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
