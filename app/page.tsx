import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import SearchBox from '@/components/SearchBox';

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await taoSupabaseServerClient();

  let query = supabase
    .from('truyen')
    .select('id, ten, slug, anh_bia, trang_thai')
    .order('created_at', { ascending: false });
  if (q) {
    query = query.ilike('ten', `%${q}%`);
  }
  const { data: dsTruyen } = await query;

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Truyện dịch AI</h1>
      <SearchBox defaultValue={q ?? ''} />
      <ul className="mt-4 space-y-2">
        {(dsTruyen ?? []).map((truyen) => (
          <li key={truyen.id}>
            <Link href={`/truyen/${truyen.slug}`} className="text-lg hover:underline">
              {truyen.ten}
            </Link>
            <span className="ml-2 text-sm text-gray-500">
              {truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
            </span>
          </li>
        ))}
        {dsTruyen?.length === 0 && <li className="text-gray-500">Không tìm thấy truyện nào.</li>}
      </ul>
    </main>
  );
}
