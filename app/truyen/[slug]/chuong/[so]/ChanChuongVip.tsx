import Link from 'next/link';
import ChonGoiVip from '@/components/ChonGoiVip';

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
    <main className="w-full max-w-xl mx-auto p-6 text-center space-y-4">
      <h1 className="text-xl font-bold">Chương {soChuong} cần gói VIP</h1>
      <p className="text-muted-foreground">
        {tenTruyen} — 50 chương đầu đọc miễn phí, từ chương 51 trở đi cần có gói VIP đang hiệu lực để
        đọc.
      </p>
      <div className="flex justify-center">
        <ChonGoiVip />
      </div>
      <Link
        href={`/truyen/${slugTruyen}`}
        className="inline-block text-sm underline text-muted-foreground"
      >
        Quay lại trang truyện
      </Link>
    </main>
  );
}
