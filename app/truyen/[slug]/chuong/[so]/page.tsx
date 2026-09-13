import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import LuuTienDo from './LuuTienDo';
import KhungDocChuong from './KhungDocChuong';

export default async function TrangDocChuong({
  params,
}: {
  params: Promise<{ slug: string; so: string }>;
}) {
  const { slug, so } = await params;
  const soChuong = parseInt(so, 10);
  const supabase = await taoSupabaseServerClient();

  const { data: truyen } = await supabase
    .from('truyen')
    .select('id, ten')
    .eq('slug', slug)
    .maybeSingle();
  if (!truyen) notFound();

  const { data: chuong } = await supabase
    .from('chuong')
    .select('id, truyen_id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyen.id)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (!chuong) notFound();

  // Ghi nhận lượt xem (chống trùng vĩnh viễn, không chặn render nội dung)
  try {
    const cookieStore = await cookies();
    const khachId = cookieStore.get('khach_id')?.value;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const visitorKey = user
      ? `nguoidung:${user.id}`
      : khachId
      ? `khach:${khachId}`
      : null;

    if (visitorKey) {
      await supabase.rpc('ghi_luot_xem', {
        p_visitor_key: visitorKey,
        p_chuong_id: chuong.id,
        p_truyen_id: chuong.truyen_id,
      });
    }
  } catch (error) {
    console.error('Lỗi khi ghi lượt xem:', error);
  }

  const [{ data: chuongTruoc }, { data: chuongSau }] = await Promise.all([
    supabase
      .from('chuong')
      .select('so_chuong')
      .eq('truyen_id', truyen.id)
      .lt('so_chuong', soChuong)
      .order('so_chuong', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('chuong')
      .select('so_chuong')
      .eq('truyen_id', truyen.id)
      .gt('so_chuong', soChuong)
      .order('so_chuong', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });

  return (
    <>
      <LuuTienDo truyenId={truyen.id} chuongId={chuong.id} />
      <KhungDocChuong
        tenTruyen={truyen.ten}
        slugTruyen={slug}
        soChuong={chuong.so_chuong}
        tieuDe={chuong.tieu_de}
        noiDung={chuong.noi_dung}
        soChuongTruoc={chuongTruoc?.so_chuong}
        soChuongSau={chuongSau?.so_chuong}
        dsChuong={(dsChuong ?? []).map((c) => ({ soChuong: c.so_chuong, tieuDe: c.tieu_de }))}
      />
    </>
  );
}
