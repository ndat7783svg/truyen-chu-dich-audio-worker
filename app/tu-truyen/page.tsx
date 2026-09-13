import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DongTruyenDaLuu from './DongTruyenDaLuu';

type HangDaLuu = {
  truyen_id: string;
  truyen: { slug: string; ten: string; anh_bia: string | null };
};

export default async function TrangTuTruyen() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dsDaLuu: HangDaLuu[] = [];
  if (user) {
    const { data } = await supabase
      .from('truyen_da_luu')
      .select('truyen_id, truyen:truyen_id(slug, ten, anh_bia)')
      .eq('nguoi_dung_id', user.id)
      .order('luu_luc', { ascending: false });
    dsDaLuu = (data as unknown as HangDaLuu[]) ?? [];
  }

  return (
    <main className="w-full max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold">Tủ truyện</h1>
      <h2 className="mt-4 text-sm font-semibold uppercase text-muted-foreground">Đã lưu</h2>

      {!user ? (
        <p className="mt-3 text-muted-foreground">
          <Link href="/dang-nhap" className="underline">
            Đăng nhập
          </Link>{' '}
          để xem truyện đã lưu.
        </p>
      ) : dsDaLuu.length === 0 ? (
        <p className="mt-3 text-muted-foreground">Chưa lưu truyện nào.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dsDaLuu.map((dong) => (
            <DongTruyenDaLuu
              key={dong.truyen_id}
              truyenId={dong.truyen_id}
              slug={dong.truyen.slug}
              ten={dong.truyen.ten}
              anhBia={dong.truyen.anh_bia}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
