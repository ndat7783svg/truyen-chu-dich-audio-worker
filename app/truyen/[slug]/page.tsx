import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

type HangTruyen = {
  id: string;
  ten: string;
  mo_ta: string | null;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

export default async function TrangTruyen({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data } = await supabase
    .from('truyen')
    .select(
      'id, ten, mo_ta, anh_bia, trang_thai, tac_gia, truyen_the_loai(the_loai(ten, slug))'
    )
    .eq('slug', slug)
    .maybeSingle();
  const truyen = data as HangTruyen | null;

  if (!truyen) notFound();

  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('id, so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });

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
    chuongDangDoc = (tienDo?.chuong as { so_chuong: number } | null) ?? null;
  }

  return (
    <main className="w-full max-w-3xl mx-auto p-4">
      <div className="flex gap-4">
        <div className="relative w-32 aspect-[2/3] shrink-0 bg-gray-200 rounded overflow-hidden">
          {truyen.anh_bia ? (
            <Image
              src={truyen.anh_bia}
              alt={truyen.ten}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400 text-xs text-center px-1">
              Chưa có ảnh bìa
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{truyen.ten}</h1>
          {truyen.tac_gia && <p className="text-gray-600">Tác giả: {truyen.tac_gia}</p>}
          <p className="text-sm text-gray-500">
            {truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
          </p>
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
        </div>
      </div>
      {truyen.mo_ta && <p className="mt-4 text-gray-600 whitespace-pre-line">{truyen.mo_ta}</p>}
      {chuongDangDoc && (
        <Link
          href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
          className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 text-white"
        >
          Đọc tiếp Chương {chuongDangDoc.so_chuong}
        </Link>
      )}
      <ul className="mt-6 space-y-1">
        {(dsChuong ?? []).map((chuong) => (
          <li key={chuong.id}>
            <Link href={`/truyen/${slug}/chuong/${chuong.so_chuong}`} className="hover:underline">
              Chương {chuong.so_chuong}: {chuong.tieu_de}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
