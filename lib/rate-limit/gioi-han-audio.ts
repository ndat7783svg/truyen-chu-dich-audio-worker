import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Benchmark cũ: 30 cuộc gọi TTS song song = 0 lỗi, 70 song song = ~53% lỗi -> chốt trần 30 toàn site (mỗi người nghe nạp trước vài đoạn song song nên cần dư).
export const GIOI_HAN_DOAN_DONG_THOI = 30;
const KHOA_DEM_DONG_THOI = 'audio_dang_tao_doan';
const TTL_DEM_GIAY = 90; // phòng trường hợp hàm chết giữa chừng làm bộ đếm kẹt

export type BoDem = {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number, option?: 'NX'): Promise<unknown>;
  set(key: string, value: number, opts?: { ex: number }): Promise<unknown>;
};

// Xin 1 "chỗ" tạo đoạn. Trả false nếu toàn site đang tạo quá nhiều đoạn cùng lúc. Fail-open khi Redis lỗi.
export async function xinSlotTaoDoan(redis: BoDem, toiDa: number = GIOI_HAN_DOAN_DONG_THOI): Promise<boolean> {
  try {
    const soDangTao = await redis.incr(KHOA_DEM_DONG_THOI);
    // NX: chỉ đặt hạn khi khoá chưa có hạn. Nếu gia hạn mỗi lần, 1 slot bị rò rỉ (hàm bị kill giữa chừng)
    // sẽ không bao giờ hết hạn khi vẫn còn người nghe -> bộ đếm kẹt và cả site trả 503.
    await redis.expire(KHOA_DEM_DONG_THOI, TTL_DEM_GIAY, 'NX');
    if (soDangTao > toiDa) {
      await redis.decr(KHOA_DEM_DONG_THOI);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function traSlotTaoDoan(redis: BoDem): Promise<void> {
  try {
    const conLai = await redis.decr(KHOA_DEM_DONG_THOI);
    if (conLai < 0) await redis.set(KHOA_DEM_DONG_THOI, 0, { ex: TTL_DEM_GIAY });
  } catch {
    // bỏ qua: bộ đếm tự hết hạn sau TTL_DEM_GIAY
  }
}

export function taoGioiHanPlaylist(redis: Redis): Ratelimit {
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '10 m'), prefix: 'gioi_han_audio_playlist' });
}

export function taoGioiHanDoan(redis: Redis): Ratelimit {
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'gioi_han_audio_doan' });
}

export async function choPhepTheoGioiHan(rl: Pick<Ratelimit, 'limit'>, ip: string | null): Promise<boolean> {
  if (!ip) return true;
  try {
    return (await rl.limit(ip)).success;
  } catch {
    return true; // Upstash lỗi -> fail-open như middleware.ts
  }
}
