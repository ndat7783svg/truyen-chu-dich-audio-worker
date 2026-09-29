import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { dinhDangSoRutGon } from '@/lib/utils/format';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import NutLuuTruyen from './NutLuuTruyen';
import MoTaTruyen from './MoTaTruyen';
import DanhSachChuongTruyen from './DanhSachChuongTruyen';
import TabTruyen from './TabTruyen';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import TheTruyen, { BiaTruyen, type TruyenThe } from '@/components/TheTruyen';
import BieuTuong from '@/components/BieuTuong';

type HangTruyen = {
  id: string;
  ten: string;
  mo_ta: string | null;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  luot_xem: number;
  truyen_the_loai: { the_loai: { id: string; ten: string; slug: string } }[];
};

type HangLienQuan = {
  truyen: {
    id: string;
    slug: string;
    ten: string;
    anh_bia: string | null;
    trang_thai: string;
    tac_gia: string | null;
    luot_xem: number;
  } | null;
};

const SO_TRUYEN_LIEN_QUAN = 6;
// Supabase trả tối đa 1000 dòng mỗi lần hỏi -> truyện >1000 chương phải lấy nhiều đợt, nếu không danh
// sách chương (và số chương hiển thị) bị cắt ở 1000 (vd "Đô Thị Chí Tôn" 1626 chương).
const SO_DONG_MOI_DOT = 1000;

async function layHetChuong(
  supabase: Awaited<ReturnType<typeof taoSupabaseServerClient>>,
  truyenId: string
): Promise<{ data: { id: string; so_chuong: number; tieu_de: string }[] }> {
  const tatCa: { id: string; so_chuong: number; tieu_de: string }[] = [];
  for (let tu = 0; ; tu += SO_DONG_MOI_DOT) {
    const { data, error } = await supabase
      .from('chuong')
      .select('id, so_chuong, tieu_de')
      .eq('truyen_id', truyenId)
      .order('so_chuong', { ascending: true })
      .range(tu, tu + SO_DONG_MOI_DOT - 1);
    if (error) throw new Error(`Lỗi tải danh sách chương: ${error.message}`);
    tatCa.push(...(data ?? []));
    if (!data || data.length < SO_DONG_MOI_DOT) break;
  }
  return { data: tatCa };
}

export default async function TrangTruyen({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data, error } = await supabase
    .from('truyen')
    .select(
      'id, ten, mo_ta, anh_bia, trang_thai, tac_gia, luot_xem, truyen_the_loai(the_loai(id, ten, slug))'
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Lỗi tải truyện "${slug}": ${error.message}`);
  const truyen = data as unknown as HangTruyen | null;

  if (!truyen) notFound();

  const idTheLoai = truyen.truyen_the_loai.map((n) => n.the_loai.id);

  const [{ data: dsChuong }, { data: dsLienQuan }, { data: authData }] = await Promise.all([
    layHetChuong(supabase, truyen.id),
    idTheLoai.length > 0
      ? supabase
          .from('truyen_the_loai')
          .select('truyen(id, slug, ten, anh_bia, trang_thai, tac_gia, luot_xem)')
          .in('the_loai_id', idTheLoai)
      : Promise.resolve({ data: [] }),
    supabase.auth.getUser(),
  ]);
  const user = authData.user;

  const chuongDauTien = (dsChuong ?? [])[0] ?? null;
  const tongChuong = dsChuong?.length ?? 0;

  let chuongDangDoc: { so_chuong: number } | null = null;
  let daLuuBanDau = false;
  let coGoiHieuLuc = false;
  if (user) {
    const [{ data: tienDo }, { data: daLuu }, { data: hoSo }] = await Promise.all([
      supabase
        .from('tien_do_doc')
        .select('chuong:chuong_id(so_chuong)')
        .eq('user_id', user.id)
        .eq('truyen_id', truyen.id)
        .maybeSingle(),
      supabase
        .from('truyen_da_luu')
        .select('truyen_id')
        .eq('nguoi_dung_id', user.id)
        .eq('truyen_id', truyen.id)
        .maybeSingle(),
      supabase.from('nguoi_dung').select('goi_het_han').eq('id', user.id).maybeSingle(),
    ]);
    chuongDangDoc = (tienDo?.chuong as unknown as { so_chuong: number } | null) ?? null;
    daLuuBanDau = !!daLuu;
    coGoiHieuLuc = conHieuLucGoi(hoSo?.goi_het_han ?? null);
  }

  // Truyện cùng thể loại: ưu tiên truyện trùng nhiều thể loại nhất, rồi tới truyện nhiều lượt xem.
  const diemLienQuan = new Map<string, { t: NonNullable<HangLienQuan['truyen']>; diem: number }>();
  for (const { truyen: t } of (dsLienQuan ?? []) as unknown as HangLienQuan[]) {
    if (!t || t.id === truyen.id) continue;
    const cu = diemLienQuan.get(t.id);
    diemLienQuan.set(t.id, { t, diem: (cu?.diem ?? 0) + 1 });
  }
  const topLienQuan = [...diemLienQuan.values()]
    .sort((a, b) => b.diem - a.diem || (b.t.luot_xem ?? 0) - (a.t.luot_xem ?? 0))
    .slice(0, SO_TRUYEN_LIEN_QUAN);
  const { data: dsSoChuong } =
    topLienQuan.length > 0
      ? await supabase
          .from('truyen_so_chuong')
          .select('truyen_id, so_chuong')
          .in(
            'truyen_id',
            topLienQuan.map((x) => x.t.id)
          )
      : { data: [] };
  const mapSoChuong = new Map((dsSoChuong ?? []).map((r) => [r.truyen_id, r.so_chuong]));
  const truyenLienQuan: TruyenThe[] = topLienQuan.map(({ t }) => ({
    slug: t.slug,
    ten: t.ten,
    tacGia: t.tac_gia,
    anhBia: t.anh_bia,
    trangThai: t.trang_thai,
    luotXem: t.luot_xem ?? 0,
    theLoai: [],
    soChuong: mapSoChuong.get(t.id) ?? 0,
  }));

  const chuongMoiNhat = [...(dsChuong ?? [])].slice(-3).reverse();
  const hoanThanh = truyen.trang_thai === 'hoan-thanh';

  return (
    <main className="pb-6">
      <section className="relative overflow-hidden border-b border-border bg-surface">
        {truyen.anh_bia && (
          <Image
            src={truyen.anh_bia}
            alt=""
            fill
            sizes="256px"
            className="object-cover opacity-20 blur-3xl"
            aria-hidden="true"
          />
        )}
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 py-6 sm:flex-row sm:items-end">
          <BiaTruyen
            truyen={{ ten: truyen.ten, anhBia: truyen.anh_bia, trangThai: truyen.trang_thai }}
            sizes="176px"
            className="w-36 shrink-0 shadow-lg sm:w-44"
          />
          <div className="flex w-full min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{truyen.ten}</h1>
            {truyen.tac_gia && (
              <p className="mt-1 text-muted-foreground">
                Tác giả: <span className="text-foreground">{truyen.tac_gia}</span>
              </p>
            )}

            <dl className="mt-4 grid w-full max-w-sm grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card/80 py-2 text-center">
              <div>
                <dd className="font-bold">{tongChuong}</dd>
                <dt className="text-xs text-muted-foreground">Chương</dt>
              </div>
              <div>
                <dd className="font-bold">{dinhDangSoRutGon(truyen.luot_xem ?? 0)}</dd>
                <dt className="text-xs text-muted-foreground">Lượt xem</dt>
              </div>
              <div>
                <dd className={`font-bold ${hoanThanh ? 'text-done' : 'text-accent'}`}>
                  {hoanThanh ? 'Hoàn thành' : 'Đang ra'}
                </dd>
                <dt className="text-xs text-muted-foreground">Trạng thái</dt>
              </div>
            </dl>

            {truyen.truyen_the_loai.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {truyen.truyen_the_loai.map((n) => (
                  <Link
                    key={n.the_loai.slug}
                    href={`/the-loai/${n.the_loai.slug}`}
                    className="rounded-full border border-border bg-card/80 px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {n.the_loai.ten}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4 flex w-full max-w-sm gap-2 sm:max-w-none">
              {chuongDangDoc ? (
                <Link
                  href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent sm:flex-none"
                >
                  <BieuTuong ten="phat" dac className="h-4 w-4" />
                  Đọc tiếp chương {chuongDangDoc.so_chuong}
                </Link>
              ) : (
                chuongDauTien && (
                  <Link
                    href={`/truyen/${slug}/chuong/${chuongDauTien.so_chuong}`}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent sm:flex-none"
                  >
                    <BieuTuong ten="phat" dac className="h-4 w-4" />
                    Bắt đầu đọc
                  </Link>
                )
              )}
              {chuongDangDoc && chuongDauTien && chuongDangDoc.so_chuong !== chuongDauTien.so_chuong && (
                <Link
                  href={`/truyen/${slug}/chuong/${chuongDauTien.so_chuong}`}
                  className="flex h-11 items-center justify-center rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:border-accent"
                >
                  Từ đầu
                </Link>
              )}
              <NutLuuTruyen truyenId={truyen.id} daLuuBanDau={daLuuBanDau} daDangNhap={!!user} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4">
        <TabTruyen
          soChuong={tongChuong}
          gioiThieu={
            <div className="space-y-6 py-4">
              {truyen.mo_ta ? (
                <MoTaTruyen moTa={truyen.mo_ta} />
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có giới thiệu.</p>
              )}
              <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
                {SO_CHUONG_FREE} chương đầu đọc miễn phí. Từ chương {SO_CHUONG_FREE + 1} cần gói VIP.
              </p>
              {chuongMoiNhat.length > 0 && (
                <div>
                  <h2 className="mb-1 font-bold">Chương mới nhất</h2>
                  <ul>
                    {chuongMoiNhat.map((c) => (
                      <li key={c.id} className="border-b border-border">
                        <Link
                          href={`/truyen/${slug}/chuong/${c.so_chuong}`}
                          prefetch={false}
                          className="flex items-center gap-2 py-2.5 text-sm hover:text-accent"
                        >
                          <span className="w-16 shrink-0 text-muted-foreground">Ch. {c.so_chuong}</span>
                          <span className="min-w-0 flex-1 truncate">{c.tieu_de}</span>
                          {c.so_chuong > SO_CHUONG_FREE && !coGoiHieuLuc && (
                            <BieuTuong ten="khoa" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
          danhSachChuong={
            <DanhSachChuongTruyen
              dsChuong={dsChuong ?? []}
              slugTruyen={slug}
              coGoiHieuLuc={coGoiHieuLuc}
              soChuongDangDoc={chuongDangDoc?.so_chuong}
            />
          }
        />

        {truyenLienQuan.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Truyện cùng thể loại</h2>
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6">
              {truyenLienQuan.map((t) => (
                <TheTruyen key={t.slug} truyen={t} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
