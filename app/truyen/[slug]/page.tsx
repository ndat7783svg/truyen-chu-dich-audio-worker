import { notFound } from 'next/navigation';
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

export default async function TrangTruyen({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data: truyen } = await supabase
    .from('truyen')
    .select('id, ten, mo_ta, anh_bia, trang_thai')
    .eq('slug', slug)
    .maybeSingle();

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
    const { data } = await supabase
      .from('tien_do_doc')
      .select('chuong:chuong_id(so_chuong)')
      .eq('user_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    chuongDangDoc = (data?.chuong as { so_chuong: number } | null) ?? null;
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold">{truyen.ten}</h1>
      {truyen.mo_ta && <p className="mt-2 text-gray-600">{truyen.mo_ta}</p>}
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
