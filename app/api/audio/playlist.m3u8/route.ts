import { type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { layIpTuHeader } from '@/lib/utils/xac-minh-bot';
import { choPhepTheoGioiHan, taoGioiHanPlaylist } from '@/lib/rate-limit/gioi-han-audio';
import { docTruyenVaChuong } from '@/lib/audio/tham-so';
import { xayDanhSachPhat } from '@/lib/audio/xay-danh-sach-phat';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const tham = docTruyenVaChuong(request.nextUrl.searchParams);
  if (!tham) return new Response('Tham số không hợp lệ', { status: 400 });

  let redis: Redis | null = null;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null; // thiếu cấu hình Upstash -> fail-open
  }

  const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
  if (redis && !(await choPhepTheoGioiHan(taoGioiHanPlaylist(redis), ip))) {
    return new Response('Quá nhanh', { status: 429 });
  }

  try {
    const kq = await xayDanhSachPhat(tham.truyenId, tham.soChuong);
    if (kq.loai === 'khong_co_chuong') return new Response('Không có chương', { status: 404 });
    if (kq.loai === 'bi_chan') return new Response('Cần đăng nhập/VIP', { status: 403 });
    return new Response(kq.m3u8, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Lỗi playlist audio:', err);
    return new Response('Lỗi máy chủ', { status: 500 });
  }
}
