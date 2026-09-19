import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { chayCoDuPhong } from './chay-co-du-phong';

const GIONG_DOC = 'vi-VN-HoaiMyNeural';
const TIMEOUT_MOT_LAN_MS = 15_000;
// Sau ngần này mà lần chạy đầu chưa xong thì chạy thêm 1 lần song song (đo thật: đoạn bình thường 0.5-6s,
// đoạn bị treo thì đứng cả chục giây -> không đợi hết timeout mới thử lại).
const HEDGE_SAU_MS = 6_000;
const SO_LAN_THU_TOI_DA = 3;
// Route doan có maxDuration = 60s: tổng thời gian các lần thử phải nhỏ hơn để hàm không bị kill giữa chừng
// (kill = không chạy finally, rò rỉ slot đồng thời, client nhận 504 mờ mịt thay vì 502 rõ ràng).
const NGAN_SACH_TONG_MS = 52_000;
const THOI_GIAN_TOI_THIEU_MOT_LAN_MS = 5_000;

export function chuanHoaXml(vanBan: string): string {
  return vanBan
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// msedge-tts thỉnh thoảng treo/ngắt giữa chừng ("Stream closed before the synthesis completed") nên
// mỗi lần thử có timeout cứng và bao cả bước mở kết nối lẫn đọc stream.
async function taoMotLan(vanBan: string, timeoutMs: number): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  let boDemGio: ReturnType<typeof setTimeout> | undefined;
  try {
    const ketQua = (async () => {
      await tts.setMetadata(GIONG_DOC, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(chuanHoaXml(vanBan));
      const cacManh: Buffer[] = [];
      return await new Promise<Buffer>((xong, loi) => {
        audioStream.on('data', (manh: Buffer) => cacManh.push(manh));
        audioStream.on('end', () => {
          const gop = Buffer.concat(cacManh);
          if (gop.length === 0) loi(new Error('Audio rỗng (0 byte)'));
          else xong(gop);
        });
        audioStream.on('error', loi);
      });
    })();
    const heoGio = new Promise<never>((_, loi) => {
      boDemGio = setTimeout(() => loi(new Error('Quá thời gian chờ TTS')), timeoutMs);
    });
    return await Promise.race([ketQua, heoGio]);
  } finally {
    if (boDemGio) clearTimeout(boDemGio);
    try {
      tts.close();
    } catch {
      // đã đóng
    }
  }
}

export function taoDoanAudio(vanBan: string): Promise<Buffer> {
  return chayCoDuPhong((timeoutMs) => taoMotLan(vanBan, timeoutMs), {
    soLanToiDa: SO_LAN_THU_TOI_DA,
    hedgeSauMs: HEDGE_SAU_MS,
    timeoutMotLanMs: TIMEOUT_MOT_LAN_MS,
    nganSachTongMs: NGAN_SACH_TONG_MS,
    toiThieuMotLanMs: THOI_GIAN_TOI_THIEU_MOT_LAN_MS,
  });
}
