import { notFound } from 'next/navigation';
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import LuuTienDo from './LuuTienDo';

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
    .select('id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyen.id)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (!chuong) notFound();

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

  return (
    <main className="w-full max-w-2xl mx-auto p-4">
      <LuuTienDo truyenId={truyen.id} chuongId={chuong.id} />
      <p className="text-sm text-gray-500">
        <Link href={`/truyen/${slug}`} className="hover:underline">
          {truyen.ten}
        </Link>
      </p>
      <h1 className="text-xl font-bold mt-1">
        Chương {chuong.so_chuong}: {chuong.tieu_de}
      </h1>
      <article className="mt-4 whitespace-pre-line leading-relaxed">{chuong.noi_dung}</article>
      <nav className="mt-6 flex justify-between">
        {chuongTruoc ? (
          <Link href={`/truyen/${slug}/chuong/${chuongTruoc.so_chuong}`} className="hover:underline">
            ← Chương trước
          </Link>
        ) : (
          <span />
        )}
        {chuongSau ? (
          <Link href={`/truyen/${slug}/chuong/${chuongSau.so_chuong}`} className="hover:underline">
            Chương sau →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
