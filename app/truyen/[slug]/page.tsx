import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { dinhDangSoRutGon } from '@/lib/utils/format';
import NutLuuTruyen from './NutLuuTruyen';
import MoTaTruyen from './MoTaTruyen';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';

type HangTruyen = {
  id: string;
  ten: string;
  mo_ta: string | null;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  luot_xem: number;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

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
      'id, ten, mo_ta, anh_bia, trang_thai, tac_gia, luot_xem, truyen_the_loai(the_loai(ten, slug))'
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Lỗi tải truyện "${slug}": ${error.message}`);
  const truyen = data as unknown as HangTruyen | null;

  if (!truyen) notFound();

  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('id, so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });

  const chuongDauTien = (dsChuong ?? [])[0] ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let chuongDangDoc: { so_chuong: number } | null = null;
  if (user) {
    const { data: tienDo } = await supabase
      .from('tien_do_doc')
      .select('chuong:chuong_id(so_chuong)')
      .eq('user_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    chuongDangDoc = (tienDo?.chuong as unknown as { so_chuong: number } | null) ?? null;
  }

  let daLuuBanDau = false;
  if (user) {
    const { data: daLuu } = await supabase
      .from('truyen_da_luu')
      .select('truyen_id')
      .eq('nguoi_dung_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    daLuuBanDau = !!daLuu;
  }

  let coGoiHieuLuc = false;
  if (user) {
    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('goi_het_han')
      .eq('id', user.id)
      .maybeSingle();
    coGoiHieuLuc = conHieuLucGoi(hoSo?.goi_het_han ?? null);
  }

  return (
    <main className="w-full max-w-3xl mx-auto p-4">
      <div className="flex gap-4">
        <div className="relative w-32 aspect-[2/3] shrink-0 bg-surface rounded overflow-hidden">
          {truyen.anh_bia ? (
            <Image
              src={truyen.anh_bia}
              alt={truyen.ten}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-xs text-center px-1">
              Chưa có ảnh bìa
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{truyen.ten}</h1>
          {truyen.tac_gia && <p className="text-muted-foreground">Tác giả: {truyen.tac_gia}</p>}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {dinhDangSoRutGon(truyen.luot_xem ?? 0)} lượt xem
            </span>
          </div>
          {truyen.truyen_the_loai.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {truyen.truyen_the_loai.map((n) => (
                <Link
                  key={n.the_loai.slug}
                  href={`/the-loai/${n.the_loai.slug}`}
                  className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {n.the_loai.ten}
                </Link>
              ))}
            </div>
          )}
          <NutLuuTruyen
            truyenId={truyen.id}
            daLuuBanDau={daLuuBanDau}
            daDangNhap={!!user}
          />
        </div>
      </div>
      {truyen.mo_ta && <MoTaTruyen moTa={truyen.mo_ta} />}
      <div className="mt-4 flex flex-wrap gap-3">
        {chuongDauTien && (
          <Link
            href={`/truyen/${slug}/chuong/${chuongDauTien.so_chuong}`}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium"
          >
            Bắt đầu đọc
          </Link>
        )}
        {chuongDangDoc && (
          <Link
            href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
            className="px-4 py-2 rounded border border-border font-medium hover:bg-black/5"
          >
            Đọc tiếp Chương {chuongDangDoc.so_chuong}
          </Link>
        )}
      </div>
      <ul className="mt-6 space-y-1">
        {(dsChuong ?? []).map((chuong) => {
          const bLKhoa = chuong.so_chuong > SO_CHUONG_FREE && !coGoiHieuLuc;
          return (
            <li key={chuong.id}>
              <Link
                href={`/truyen/${slug}/chuong/${chuong.so_chuong}`}
                className="flex items-center gap-1.5 hover:underline"
              >
                {bLKhoa && (
                  <svg
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
                    />
                  </svg>
                )}
                Chương {chuong.so_chuong}: {chuong.tieu_de}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
