import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const GIONG_DOC = 'vi-VN-HoaiMyNeural';
const TIMEOUT_MOT_LAN_MS = 18_000;
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

export async function taoDoanAudio(vanBan: string): Promise<Buffer> {
  let loiCuoi: unknown;
  const batDau = Date.now();
  for (let lan = 1; lan <= SO_LAN_THU_TOI_DA; lan += 1) {
    const conLaiMs = NGAN_SACH_TONG_MS - (Date.now() - batDau);
    if (conLaiMs < THOI_GIAN_TOI_THIEU_MOT_LAN_MS) break;
    try {
      return await taoMotLan(vanBan, Math.min(TIMEOUT_MOT_LAN_MS, conLaiMs));
    } catch (err) {
      loiCuoi = err;
      if (lan < SO_LAN_THU_TOI_DA) await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (loiCuoi === undefined) throw new Error('Hết ngân sách thời gian tạo đoạn audio');
  throw loiCuoi instanceof Error ? loiCuoi : new Error(String(loiCuoi));
}
