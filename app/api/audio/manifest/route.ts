import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { layIpTuHeader } from '@/lib/utils/xac-minh-bot';
import { choPhepTheoGioiHan, taoGioiHanPlaylist } from '@/lib/rate-limit/gioi-han-audio';
import { docTruyenVaChuong } from '@/lib/audio/tham-so';
import { xayDanhSachPhat } from '@/lib/audio/xay-danh-sach-phat';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const tham = docTruyenVaChuong(request.nextUrl.searchParams);
  if (!tham) return NextResponse.json({ loi: 'tham_so_khong_hop_le' }, { status: 400 });

  let redis: Redis | null = null;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null; // thiếu cấu hình Upstash -> fail-open
  }

  const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
  if (redis && !(await choPhepTheoGioiHan(taoGioiHanPlaylist(redis), ip))) {
    return NextResponse.json({ loi: 'qua_nhanh' }, { status: 429 });
  }

  try {
    const kq = await xayDanhSachPhat(tham.truyenId, tham.soChuong);
    if (kq.loai === 'khong_co_chuong') return NextResponse.json({ loi: 'khong_co_chuong' }, { status: 404 });
    if (kq.loai === 'bi_chan') {
      return NextResponse.json({ lyDo: kq.dungLai.lyDo, soChuong: kq.dungLai.soChuong }, { status: 403 });
    }
    return NextResponse.json(kq.manifest, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('Lỗi manifest audio:', err);
    return NextResponse.json({ loi: 'loi_may_chu' }, { status: 500 });
  }
}
