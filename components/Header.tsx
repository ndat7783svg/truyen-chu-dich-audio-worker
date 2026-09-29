import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DropdownTheLoai from './DropdownTheLoai';
import SearchBox from './SearchBox';
import BieuTuong from './BieuTuong';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();

  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
            <BieuTuong ten="sach" className="h-4.5 w-4.5" />
          </span>
          <span className="text-base sm:text-lg">Truyện chữ dịch</span>
        </Link>
        <nav className="ml-1">
          <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
        </nav>
        <div className="ml-auto flex min-w-0 justify-end md:flex-1 md:max-w-md">
          <SearchBox defaultValue="" />
        </div>
      </div>
    </header>
  );
}
