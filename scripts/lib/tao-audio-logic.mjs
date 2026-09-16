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

const NGUONG_KHONG_HOAT_DONG_GIO = 12;

// Tu dong xoa toan bo audio cua 1 bo truyen neu qua NGUONG_KHONG_HOAT_DONG_GIO khong ai nghe -
// tiet kiem File Storage (free tier 1GB, khong du cho nhieu truyen luu vinh vien). Chi xoa nhung
// bo truyen dang CO audio_url (tranh truy van/xoa vo ich). audio_truy_cap_luc duoc ghi nhan moi
// khi co nguoi thuc su bam phat (xem ham ghi_nhan_nghe_audio RPC + ModalNgheAudioThat.tsx).
export async function donDepAudioKhongHoatDong(supabase) {
  const nguongThoiGian = new Date(Date.now() - NGUONG_KHONG_HOAT_DONG_GIO * 60 * 60 * 1000).toISOString();

  const { data: truyenCanDon, error: loiTruyVan } = await supabase
    .from('truyen')
    .select('id, ten, audio_truy_cap_luc')
    .lt('audio_truy_cap_luc', nguongThoiGian);

  if (loiTruyVan) {
    console.error('Loi truy van truyen can don audio:', loiTruyVan.message);
    return { soTruyenDaDon: 0, soFileDaXoa: 0 };
  }

  if (!truyenCanDon || truyenCanDon.length === 0) {
    return { soTruyenDaDon: 0, soFileDaXoa: 0 };
  }

  let soFileDaXoa = 0;
  let soTruyenDaDon = 0;

  for (const truyen of truyenCanDon) {
    // Chi don neu bo truyen nay thuc su con chuong co audio_url (tranh xoa lap lai vo ich)
    const { count: soChuongConAudio } = await supabase
      .from('chuong')
      .select('id', { count: 'exact', head: true })
      .eq('truyen_id', truyen.id)
      .not('audio_url', 'is', null);

    if (!soChuongConAudio || soChuongConAudio === 0) continue;

    const { data: dsFile, error: loiList } = await supabase.storage
      .from(TEN_BUCKET_AUDIO)
      .list(truyen.id, { limit: 1000 });

    if (loiList) {
      console.error(`Loi list file audio cua truyen "${truyen.ten}":`, loiList.message);
      continue;
    }

    if (dsFile && dsFile.length > 0) {
      const duongDanXoa = dsFile.map((f) => `${truyen.id}/${f.name}`);
      const { error: loiXoaFile } = await supabase.storage.from(TEN_BUCKET_AUDIO).remove(duongDanXoa);
      if (loiXoaFile) {
        console.error(`Loi xoa file audio cua truyen "${truyen.ten}":`, loiXoaFile.message);
        continue;
      }
      soFileDaXoa += duongDanXoa.length;
    }

    const { error: loiUpdate } = await supabase
      .from('chuong')
      .update({ audio_url: null })
      .eq('truyen_id', truyen.id);

    if (loiUpdate) {
      console.error(`Loi reset audio_url cua truyen "${truyen.ten}":`, loiUpdate.message);
      continue;
    }

    soTruyenDaDon += 1;
    console.log(`Da don audio bo truyen "${truyen.ten}" (khong hoat dong > ${NGUONG_KHONG_HOAT_DONG_GIO}h).`);
  }

  return { soTruyenDaDon, soFileDaXoa };
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
