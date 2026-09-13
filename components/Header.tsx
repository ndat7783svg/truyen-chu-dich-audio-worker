import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DropdownTheLoai from './DropdownTheLoai';
import SearchBox from './SearchBox';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();

  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="w-full border-b border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-lg">
            <svg
              className="w-5 h-5 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2V5zM20 5a2 2 0 00-2-2h-5v18h5a2 2 0 002-2V5z"
              />
            </svg>
            Truyện chữ dịch
          </Link>
          <nav>
            <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
          </nav>
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <SearchBox defaultValue="" />
        </div>
      </div>
    </header>
  );
}
