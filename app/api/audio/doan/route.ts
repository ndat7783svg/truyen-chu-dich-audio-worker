import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { layIpTuHeader } from '@/lib/utils/xac-minh-bot';
import {
  choPhepTheoGioiHan,
  taoGioiHanDoan,
  traSlotTaoDoan,
  xinSlotTaoDoan,
} from '@/lib/rate-limit/gioi-han-audio';
import { docChiSoDoan, docTruyenVaChuong, docVe } from '@/lib/audio/tham-so';
import { kiemVe } from '@/lib/audio/ve-audio';
import { chiaDoan } from '@/lib/audio/chia-doan';
import { layMotChuong, taoSupabaseDichVu } from '@/lib/audio/du-lieu-chuong';
import { taoDoanAudio } from '@/lib/audio/tao-doan-audio';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const tham = docTruyenVaChuong(p);
  const chiSo = docChiSoDoan(p);
  if (!tham || chiSo === null) return NextResponse.json({ loi: 'tham_so_khong_hop_le' }, { status: 400 });

  const laChuongVip = tham.soChuong > SO_CHUONG_FREE;
  if (laChuongVip) {
    const ve = docVe(p);
    const boMat = process.env.AUDIO_TICKET_SECRET;
    if (!ve || !boMat || !kiemVe(boMat, tham.truyenId, ve, tham.soChuong)) {
      return NextResponse.json({ loi: 've_khong_hop_le' }, { status: 403 });
    }
  }

  let redis: Redis | null = null;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null; // thiếu cấu hình Upstash -> fail-open
  }

  const ip = layIpTuHeader(request.headers.get('x-forwarded-for'));
  if (redis && !(await choPhepTheoGioiHan(taoGioiHanDoan(redis), ip))) {
    return NextResponse.json({ loi: 'qua_nhanh' }, { status: 429 });
  }

  try {
    const t0 = Date.now();
    const chuong = await layMotChuong(taoSupabaseDichVu(), tham.truyenId, tham.soChuong);
    const msDb = Date.now() - t0;
    if (!chuong) return NextResponse.json({ loi: 'khong_co_chuong' }, { status: 404 });
    const cacDoan = chiaDoan(chuong.tieuDe, chuong.noiDung);
    if (chiSo >= cacDoan.length) return NextResponse.json({ loi: 'khong_co_doan' }, { status: 404 });

    const t1 = Date.now();
    const coSlot = !redis || (await xinSlotTaoDoan(redis));
    const msSlot = Date.now() - t1;
    if (!coSlot) {
      return NextResponse.json({ loi: 'qua_tai' }, { status: 503, headers: { 'Retry-After': '5' } });
    }
    try {
      const thongKe = { soLanPhat: 0, lanThang: 0 };
      const t2 = Date.now();
      const mp3 = await taoDoanAudio(cacDoan[chiSo], thongKe);
      const msTts = Date.now() - t2;
      return new Response(new Uint8Array(mp3), {
        headers: {
          'Content-Type': 'audio/mpeg',
          // Chẩn đoán: thời gian từng bước + số lần thử TTS / lần thắng (xem trong tab Network hoặc curl -D).
          'Server-Timing': `db;dur=${msDb}, slot;dur=${msSlot}, tts;dur=${msTts};desc="phat=${thongKe.soLanPhat} thang=${thongKe.lanThang}"`,
          'Cache-Control': laChuongVip
            ? 'private, max-age=3600' // cho trình duyệt giữ (nạp trước/nghe lại), CDN dùng chung KHÔNG được lưu
            : 'public, max-age=3600, s-maxage=86400',
        },
      });
    } finally {
      if (redis) await traSlotTaoDoan(redis);
    }
  } catch (err) {
    console.error('Lỗi tạo đoạn audio:', err);
    return NextResponse.json({ loi: 'tao_doan_that_bai' }, { status: 502 });
  }
}
