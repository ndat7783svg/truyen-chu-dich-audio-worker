import Link from 'next/link';
import ChonGoiVip from '@/components/ChonGoiVip';
import BieuTuong from '@/components/BieuTuong';

export default function ChanChuongVip({
  tenTruyen,
  slugTruyen,
  soChuong,
}: {
  tenTruyen: string;
  slugTruyen: string;
  soChuong: number;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <BieuTuong ten="khoa" className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">Chương {soChuong} cần gói VIP</h1>
        <p className="text-muted-foreground">
          {tenTruyen} — 50 chương đầu đọc miễn phí, từ chương 51 trở đi cần có gói VIP đang hiệu lực để
          đọc.
        </p>
        <ChonGoiVip />
        <div>
          <Link
            href={`/truyen/${slugTruyen}`}
            className="inline-block text-sm text-muted-foreground underline hover:text-accent"
          >
            Quay lại trang truyện
          </Link>
        </div>
      </div>
    </main>
  );
}
