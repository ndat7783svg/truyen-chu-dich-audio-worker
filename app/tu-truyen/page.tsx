import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DongTruyenDaLuu from './DongTruyenDaLuu';
import BieuTuong from '@/components/BieuTuong';

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
    <main className="mx-auto w-full max-w-2xl px-4 py-5">
      <h1 className="text-2xl font-bold">Tủ truyện</h1>
      <h2 className="mt-4 text-sm font-semibold text-muted-foreground">
        Đã lưu{user && dsDaLuu.length > 0 ? ` · ${dsDaLuu.length}` : ''}
      </h2>

      {!user || dsDaLuu.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <BieuTuong ten="tu-sach" className="h-8 w-8 text-muted-foreground" />
          {!user ? (
            <>
              <p className="text-muted-foreground">Đăng nhập để xem truyện đã lưu.</p>
              <Link
                href="/dang-nhap"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
              >
                Đăng nhập
              </Link>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Bấm nút &ldquo;Lưu&rdquo; ở trang truyện để thêm truyện vào tủ.
              </p>
              <Link href="/" className="text-sm font-semibold text-accent hover:underline">
                Khám phá truyện
              </Link>
            </>
          )}
        </div>
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
