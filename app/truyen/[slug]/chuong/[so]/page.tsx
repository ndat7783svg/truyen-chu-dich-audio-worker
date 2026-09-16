import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import { tinhNhomCuaChuong, KICH_THUOC_NHOM_CHUONG } from '@/lib/utils/chuong';
import LuuTienDo from './LuuTienDo';
import KhungDocChuong from './KhungDocChuong';
import ChanChuongVip from './ChanChuongVip';

export default async function TrangDocChuong({
  params,
}: {
  params: Promise<{ slug: string; so: string }>;
}) {
  const { slug, so } = await params;
  const soChuong = parseInt(so, 10);
  const supabase = await taoSupabaseServerClient();

  const { data: truyen, error: loiTruyen } = await supabase
    .from('truyen')
    .select('id, ten')
    .eq('slug', slug)
    .maybeSingle();
  if (loiTruyen) throw new Error(`Lỗi tải truyện "${slug}": ${loiTruyen.message}`);
  if (!truyen) notFound();

  const { data: chuong, error: loiChuong } = await supabase
    .from('chuong')
    .select('id, truyen_id, so_chuong, tieu_de, audio_url')
    .eq('truyen_id', truyen.id)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (loiChuong) throw new Error(`Lỗi tải chương ${soChuong} của truyện "${slug}": ${loiChuong.message}`);
  if (!chuong) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (chuong.so_chuong > SO_CHUONG_FREE) {
    if (!user) redirect('/dang-nhap');

    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('goi_het_han')
      .eq('id', user.id)
      .maybeSingle();

    if (!conHieuLucGoi(hoSo?.goi_het_han ?? null)) {
      return <ChanChuongVip tenTruyen={truyen.ten} slugTruyen={slug} soChuong={chuong.so_chuong} />;
    }
  }

  const { data: noiDung, error: loiNoiDung } = await supabase.rpc('lay_noi_dung_chuong', {
    p_chuong_id: chuong.id,
  });
  if (loiNoiDung) throw new Error(`Lỗi tải nội dung chương ${soChuong}: ${loiNoiDung.message}`);
  if (noiDung == null) notFound();

  // Ghi nhận lượt xem (chống trùng vĩnh viễn, không chặn render nội dung)
  try {
    const cookieStore = await cookies();
    const khachId = cookieStore.get('khach_id')?.value;

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

  const soNhomBanDau = tinhNhomCuaChuong(soChuong);
  const tuChuong = soNhomBanDau * KICH_THUOC_NHOM_CHUONG + 1;
  const denChuong = (soNhomBanDau + 1) * KICH_THUOC_NHOM_CHUONG;

  const [{ data: chuongTruoc }, { data: chuongSau }, { data: dsChuongBanDau }, { data: chuongCuoi }] =
    await Promise.all([
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
        .select('id, so_chuong')
        .eq('truyen_id', truyen.id)
        .gt('so_chuong', soChuong)
        .order('so_chuong', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('chuong')
        .select('so_chuong, tieu_de')
        .eq('truyen_id', truyen.id)
        .gte('so_chuong', tuChuong)
        .lte('so_chuong', denChuong)
        .order('so_chuong', { ascending: true }),
      supabase
        .from('chuong')
        .select('so_chuong')
        .eq('truyen_id', truyen.id)
        .order('so_chuong', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const tongSoChuong = chuongCuoi?.so_chuong ?? 0;

  return (
    <>
      <LuuTienDo truyenId={truyen.id} chuongId={chuong.id} />
      <KhungDocChuong
        chuongId={chuong.id}
        tenTruyen={truyen.ten}
        slugTruyen={slug}
        truyenId={truyen.id}
        soChuong={chuong.so_chuong}
        tieuDe={chuong.tieu_de}
        noiDung={noiDung}
        audioUrl={chuong.audio_url ?? null}
        soChuongTruoc={chuongTruoc?.so_chuong}
        soChuongSau={chuongSau?.so_chuong}
        chuongIdSau={chuongSau?.id}
        tongSoChuong={tongSoChuong}
        soNhomBanDau={soNhomBanDau}
        dsChuongBanDau={(dsChuongBanDau ?? []).map((c) => ({
          soChuong: c.so_chuong,
          tieuDe: c.tieu_de,
        }))}
      />
    </>
  );
}
