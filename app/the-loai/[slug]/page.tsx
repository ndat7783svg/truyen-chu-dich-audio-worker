import { notFound } from 'next/navigation';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';
import ThongBaoFanpage from '@/components/ThongBaoFanpage';

type HangLienKet = {
  truyen: {
    id: string;
    slug: string;
    ten: string;
    anh_bia: string | null;
    trang_thai: string;
    tac_gia: string | null;
    luot_xem: number;
  };
};

export default async function TrangTheLoai({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data: theLoai, error: loiTheLoai } = await supabase
    .from('the_loai')
    .select('id, ten, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (loiTheLoai) throw new Error(`Lỗi tải thể loại "${slug}": ${loiTheLoai.message}`);

  if (!theLoai) notFound();

  const { data } = await supabase
    .from('truyen_the_loai')
    .select('truyen(id, slug, ten, anh_bia, trang_thai, tac_gia, luot_xem)')
    .eq('the_loai_id', theLoai.id);

  const dsLienKet = (data ?? []) as unknown as HangLienKet[];

  const { data: dsSoChuong } = await supabase
    .from('truyen_so_chuong')
    .select('truyen_id, so_chuong');
  const mapSoChuong = new Map(
    (dsSoChuong ?? []).map((r) => [r.truyen_id, r.so_chuong])
  );

  const dsThe: TruyenThe[] = dsLienKet.map((lk) => ({
    slug: lk.truyen.slug,
    ten: lk.truyen.ten,
    tacGia: lk.truyen.tac_gia,
    anhBia: lk.truyen.anh_bia,
    trangThai: lk.truyen.trang_thai,
    luotXem: lk.truyen.luot_xem ?? 0,
    theLoai: [],
    soChuong: mapSoChuong.get(lk.truyen.id) ?? 0,
  }));

  return (
    <>
      <ThongBaoFanpage />
      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        <p className="text-sm text-muted-foreground">Thể loại</p>
        <h1 className="mb-4 text-2xl font-bold">
          {theLoai.ten}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{dsThe.length} truyện</span>
        </h1>
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {dsThe.map((truyen) => (
            <TheTruyen key={truyen.slug} truyen={truyen} />
          ))}
        </div>
        {dsThe.length === 0 && (
          <p className="text-muted-foreground">Chưa có truyện nào thuộc thể loại này.</p>
        )}
      </main>
    </>
  );
}
