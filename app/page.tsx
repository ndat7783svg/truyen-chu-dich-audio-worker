import { taoSupabaseServerClient } from '@/lib/supabase/server';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';
import ThongBaoFanpage from '@/components/ThongBaoFanpage';
import {
  BangXepHang,
  DanhSachTheLoai,
  KeTruyen,
  TieuDeMuc,
  TruyenNoiBat,
} from '@/components/KhoiTrangChu';
import { thoiGianTruoc } from '@/lib/utils/format';

type HangTruyen = {
  id: string;
  ten: string;
  slug: string;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  luot_xem: number;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

type HangTienDo = {
  truyen_id: string;
  chuong: { so_chuong: number } | null;
};

const SO_THE_LOAI_HIEN = 12;

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const tuKhoa = q?.trim() ?? '';
  const supabase = await taoSupabaseServerClient();

  let query = supabase
    .from('truyen')
    .select(
      'id, ten, slug, anh_bia, trang_thai, tac_gia, luot_xem, truyen_the_loai(the_loai(ten, slug))'
    )
    .order('created_at', { ascending: false });
  if (tuKhoa) {
    query = query.ilike('ten', `%${tuKhoa}%`);
  }
  const [{ data, error }, { data: dsSoChuong }] = await Promise.all([
    query,
    supabase.from('truyen_so_chuong').select('truyen_id, so_chuong'),
  ]);
  if (error) throw new Error(`Lỗi tải danh sách truyện: ${error.message}`);
  const dsTruyen = (data ?? []) as unknown as HangTruyen[];

  const mapSoChuong = new Map((dsSoChuong ?? []).map((r) => [r.truyen_id, r.so_chuong]));
  const sangThe = (t: HangTruyen): TruyenThe => ({
    slug: t.slug,
    ten: t.ten,
    tacGia: t.tac_gia,
    anhBia: t.anh_bia,
    trangThai: t.trang_thai,
    luotXem: t.luot_xem ?? 0,
    theLoai: t.truyen_the_loai.map((n) => n.the_loai),
    soChuong: mapSoChuong.get(t.id) ?? 0,
  });
  const dsThe = dsTruyen.map(sangThe);

  // Tìm kiếm: chỉ hiện kết quả, không hiện các mục giới thiệu.
  if (tuKhoa) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        <h1 className="text-xl font-bold">
          Kết quả cho &ldquo;{tuKhoa}&rdquo;
          <span className="ml-2 text-sm font-normal text-muted-foreground">{dsThe.length} truyện</span>
        </h1>
        {dsThe.length > 0 ? (
          <LuoiTruyen dsThe={dsThe} />
        ) : (
          <p className="mt-4 text-muted-foreground">
            Không tìm thấy truyện nào. Thử gõ ngắn hơn, ví dụ một vài chữ trong tên truyện.
          </p>
        )}
      </main>
    );
  }

  const truyenMoi = dsTruyen[0] ?? null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Chương mới nhất của từng truyện: chương có số lớn nhất (dùng sẵn chỉ mục truyen_id + so_chuong).
  const [dsChuongMoiNhat, { data: moTaNoiBat }, { data: dsTienDo }] = await Promise.all([
    Promise.all(
      dsTruyen.map(async (t) => {
        const { data: c } = await supabase
          .from('chuong')
          .select('so_chuong, created_at')
          .eq('truyen_id', t.id)
          .order('so_chuong', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { truyen: t, chuong: c };
      })
    ),
    truyenMoi
      ? supabase.from('truyen').select('mo_ta').eq('id', truyenMoi.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('tien_do_doc')
          .select('truyen_id, chuong:chuong_id(so_chuong)')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
  ]);

  const mapTruyen = new Map(dsTruyen.map((t) => [t.id, t]));

  const docTiep = ((dsTienDo ?? []) as unknown as HangTienDo[])
    .filter((td) => td.chuong && mapTruyen.has(td.truyen_id))
    .map((td) => {
      const t = mapTruyen.get(td.truyen_id)!;
      const soChuong = td.chuong!.so_chuong;
      const tong = mapSoChuong.get(t.id) ?? 0;
      return {
        truyen: sangThe(t),
        href: `/truyen/${t.slug}/chuong/${soChuong}`,
        dong1: `Đọc tiếp ch. ${soChuong}`,
        dong2: tong ? `${soChuong}/${tong} chương` : undefined,
      };
    });

  const moiCapNhat = dsChuongMoiNhat
    .filter((x) => x.chuong)
    .sort((a, b) => (b.chuong!.created_at > a.chuong!.created_at ? 1 : -1))
    .slice(0, 12)
    .map((x) => ({
      // Dẫn về trang truyện, không dẫn thẳng chương mới nhất (thường là chương VIP -> khách bị chặn).
      truyen: sangThe(x.truyen),
      dong1: `Chương ${x.chuong!.so_chuong}`,
      dong2: thoiGianTruoc(x.chuong!.created_at),
    }));

  const xemNhieu = [...dsThe].sort((a, b) => (b.luotXem ?? 0) - (a.luotXem ?? 0)).slice(0, 5);

  const demTheLoai = new Map<string, { ten: string; slug: string; so: number }>();
  for (const t of dsTruyen) {
    for (const { the_loai } of t.truyen_the_loai) {
      const cu = demTheLoai.get(the_loai.slug);
      demTheLoai.set(the_loai.slug, { ...the_loai, so: (cu?.so ?? 0) + 1 });
    }
  }
  const theLoaiPhoBien = [...demTheLoai.values()]
    .sort((a, b) => b.so - a.so || a.ten.localeCompare(b.ten, 'vi'))
    .slice(0, SO_THE_LOAI_HIEN);

  return (
    <>
      <ThongBaoFanpage />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-5">
        {truyenMoi && (
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TruyenNoiBat truyen={sangThe(truyenMoi)} moTa={moTaNoiBat?.mo_ta ?? null} />
            </div>
            <div>
              <TieuDeMuc>Xem nhiều nhất</TieuDeMuc>
              <BangXepHang dsTruyen={xemNhieu} />
            </div>
          </section>
        )}

        {docTiep.length > 0 && (
          <section>
            <TieuDeMuc>Đọc tiếp</TieuDeMuc>
            <KeTruyen dsMuc={docTiep} />
          </section>
        )}

        {moiCapNhat.length > 0 && (
          <section>
            <TieuDeMuc>Mới cập nhật</TieuDeMuc>
            <KeTruyen dsMuc={moiCapNhat} />
          </section>
        )}

        {theLoaiPhoBien.length > 0 && (
          <section>
            <TieuDeMuc>Thể loại</TieuDeMuc>
            <DanhSachTheLoai dsTheLoai={theLoaiPhoBien} />
          </section>
        )}

        <section id="tat-ca">
          <TieuDeMuc
            phai={<span className="text-sm text-muted-foreground">{dsThe.length} truyện</span>}
          >
            Tất cả truyện
          </TieuDeMuc>
          {dsThe.length > 0 ? (
            <LuoiTruyen dsThe={dsThe} />
          ) : (
            <p className="text-muted-foreground">Chưa có truyện nào.</p>
          )}
        </section>
      </main>
    </>
  );
}

function LuoiTruyen({ dsThe }: { dsThe: TruyenThe[] }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {dsThe.map((truyen) => (
        <TheTruyen key={truyen.slug} truyen={truyen} />
      ))}
    </div>
  );
}
