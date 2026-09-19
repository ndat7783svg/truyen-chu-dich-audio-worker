import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const GIONG_DOC = 'vi-VN-HoaiMyNeural';
const TIMEOUT_MOT_LAN_MS = 25_000;
const SO_LAN_THU_TOI_DA = 3;

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
async function taoMotLan(vanBan: string): Promise<Buffer> {
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
      boDemGio = setTimeout(() => loi(new Error('Quá thời gian chờ TTS')), TIMEOUT_MOT_LAN_MS);
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
  for (let lan = 1; lan <= SO_LAN_THU_TOI_DA; lan += 1) {
    try {
      return await taoMotLan(vanBan);
    } catch (err) {
      loiCuoi = err;
      if (lan < SO_LAN_THU_TOI_DA) await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw loiCuoi instanceof Error ? loiCuoi : new Error(String(loiCuoi));
}
