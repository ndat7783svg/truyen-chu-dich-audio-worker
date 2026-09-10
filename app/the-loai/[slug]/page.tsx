import { notFound } from 'next/navigation';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';

type HangLienKet = {
  truyen: {
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

  const { data: theLoai } = await supabase
    .from('the_loai')
    .select('id, ten, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!theLoai) notFound();

  const { data } = await supabase
    .from('truyen_the_loai')
    .select('truyen(slug, ten, anh_bia, trang_thai, tac_gia, luot_xem)')
    .eq('the_loai_id', theLoai.id);

  const dsLienKet = (data ?? []) as HangLienKet[];
  const dsThe: TruyenThe[] = dsLienKet.map((lk) => ({
    slug: lk.truyen.slug,
    ten: lk.truyen.ten,
    tacGia: lk.truyen.tac_gia,
    anhBia: lk.truyen.anh_bia,
    trangThai: lk.truyen.trang_thai,
    luotXem: lk.truyen.luot_xem ?? 0,
    theLoai: [],
  }));

  return (
    <main className="w-full max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Thể loại: {theLoai.ten}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dsThe.map((truyen) => (
          <TheTruyen key={truyen.slug} truyen={truyen} />
        ))}
      </div>
      {dsThe.length === 0 && (
        <p className="text-gray-500">Chưa có truyện nào thuộc thể loại này.</p>
      )}
    </main>
  );
}
