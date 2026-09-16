import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const GIONG_DOC = 'vi-VN-HoaiMyNeural';
export const DINH_DANG_AUDIO = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
export const TEN_BUCKET_AUDIO = 'audio-chuong';

export function chuanHoaXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function damBaoBucketStorage(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Loi kiem tra bucket storage:', error.message);
    process.exit(1);
  }

  const tonTai = (buckets || []).some((b) => b.name === TEN_BUCKET_AUDIO);
  if (!tonTai) {
    const { error: loiTao } = await supabase.storage.createBucket(TEN_BUCKET_AUDIO, {
      public: true,
    });
    if (loiTao) {
      console.error(`Loi tao bucket storage "${TEN_BUCKET_AUDIO}":`, loiTao.message);
      process.exit(1);
    }
    console.log(`Da tao bucket storage "${TEN_BUCKET_AUDIO}" (public).`);
  }
}

// msedge-tts thinh thoang treo vo thoi han (khong bao loi, khong ket thuc stream) - da gap thuc te
// khi test, co lan treo hon 12 phut khong phan hoi. Bat buoc phai co timeout cung de 1 chuong bi
// treo khong lam ket toan bo worker/batch dang chay.
const TIMEOUT_TAO_AUDIO_MS = 3 * 60 * 1000; // 3 phut - benchmark thuc te toi da ~127s/chuong

export async function taoAudioBuffer(tieuDe, noiDung) {
  const tts = new MsEdgeTTS();

  // Bao trum CA buoc setMetadata (mo ket noi WebSocket) lan buoc doc stream trong timeout - da gap
  // thuc te truong hop setMetadata() tu treo vo thoi han (khong loi, khong tiep tuc), khien timeout
  // dat o rieng buoc doc stream khong bao gio duoc kich hoat.
  const promiseTaoAudio = (async () => {
    await tts.setMetadata(GIONG_DOC, DINH_DANG_AUDIO);

    const vanBanTho = `${tieuDe}. ${noiDung}`.trim();
    const vanBanAnToan = chuanHoaXml(vanBanTho);

    return new Promise((resolve, reject) => {
      let audioStream;
      try {
        const res = tts.toStream(vanBanAnToan);
        audioStream = res.audioStream;
      } catch (err) {
        tts.close();
        return reject(err);
      }

      const chunks = [];
      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      audioStream.on('end', () => {
        tts.close();
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          return reject(new Error('Audio stream ket thuc nhung khong co du lieu (0 bytes).'));
        }
        resolve(buffer);
      });

      audioStream.on('error', (err) => {
        tts.close();
        reject(err);
      });
    });
  })();

  const promiseTimeout = new Promise((_, reject) => {
    setTimeout(() => {
      tts.close();
      reject(new Error(`Qua thoi gian cho (${TIMEOUT_TAO_AUDIO_MS / 1000}s), co the msedge-tts bi treo.`));
    }, TIMEOUT_TAO_AUDIO_MS);
  });

  return Promise.race([promiseTaoAudio, promiseTimeout]);
}

export async function uploadVaCapNhat(supabase, truyenId, chuong, buffer) {
  const duongDanStorage = `${truyenId}/${chuong.so_chuong}.mp3`;

  const { error: loiUpload } = await supabase.storage
    .from(TEN_BUCKET_AUDIO)
    .upload(duongDanStorage, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (loiUpload) {
    throw new Error(`Upload storage that bai: ${loiUpload.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(TEN_BUCKET_AUDIO).getPublicUrl(duongDanStorage);

  const { error: loiUpdate } = await supabase
    .from('chuong')
    .update({ audio_url: publicUrl })
    .eq('id', chuong.id);

  if (loiUpdate) {
    throw new Error(`Update DB that bai: ${loiUpdate.message}`);
  }

  return publicUrl;
}

export async function chayPoolSongSong(danhSach, gioiHan, hamXuLy, onTienDo) {
  const ketQua = [];
  let index = 0;

  async function worker() {
    while (index < danhSach.length) {
      const currentIndex = index;
      index += 1;
      const item = danhSach[currentIndex];
      const res = await hamXuLy(item);
      ketQua.push(res);
      if (onTienDo) {
        onTienDo(res, ketQua.length, danhSach.length);
      }
    }
  }

  const soWorkers = Math.min(gioiHan, danhSach.length);
  const workers = Array.from({ length: soWorkers }, () => worker());
  await Promise.all(workers);
  return ketQua;
}
