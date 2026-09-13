import { taoSupabaseServerClient } from '@/lib/supabase/server';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';
import ThongBaoFanpage from '@/components/ThongBaoFanpage';

type HangTruyen = {
  ten: string;
  slug: string;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  luot_xem: number;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
  chuong: { count: number }[];
};

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await taoSupabaseServerClient();

  let query = supabase
    .from('truyen')
    .select(
      'ten, slug, anh_bia, trang_thai, tac_gia, luot_xem, truyen_the_loai(the_loai(ten, slug)), chuong(count)'
    )
    .order('created_at', { ascending: false });
  if (q) {
    query = query.ilike('ten', `%${q}%`);
  }
  const { data } = await query;
  const dsTruyen = (data ?? []) as unknown as HangTruyen[];

  const dsThe: TruyenThe[] = dsTruyen.map((t) => ({
    slug: t.slug,
    ten: t.ten,
    tacGia: t.tac_gia,
    anhBia: t.anh_bia,
    trangThai: t.trang_thai,
    luotXem: t.luot_xem ?? 0,
    theLoai: t.truyen_the_loai.map((n) => n.the_loai),
    soChuong: t.chuong?.[0]?.count ?? 0,
  }));

  return (
    <>
      <ThongBaoFanpage />
      <main className="w-full max-w-5xl mx-auto p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {dsThe.map((truyen) => (
            <TheTruyen key={truyen.slug} truyen={truyen} />
          ))}
        </div>
        {dsThe.length === 0 && (
          <p className="mt-4 text-muted-foreground">Không tìm thấy truyện nào.</p>
        )}
      </main>
    </>
  );
}
