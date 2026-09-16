#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import {
  damBaoBucketStorage,
  taoAudioBuffer,
  uploadVaCapNhat,
  chayPoolSongSong,
} from './lib/tao-audio-logic.mjs';

const GIOI_HAN_QUEUE = 5;
const GIOI_HAN_SONG_SONG = 2; // Muc song song thap de dam bao on dinh tren may ca nhan

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thieu bien moi truong SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY.');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Dam bao bucket audio-chuong ton tai
  await damBaoBucketStorage(supabase);

  // Lay toi da 5 chuong can tao audio trong hang doi (so_lan_loi < 3)
  const { data: hangDoi, error: loiHangDoi } = await supabase
    .from('hang_doi_audio')
    .select('chuong_id, truyen_id, so_chuong, so_lan_loi, yeu_cau_luc')
    .lt('so_lan_loi', 3)
    .order('yeu_cau_luc', { ascending: true })
    .limit(GIOI_HAN_QUEUE);

  if (loiHangDoi) {
    console.error('Loi truy van hang doi audio:', loiHangDoi.message);
    process.exitCode = 1;
    return;
  }

  if (!hangDoi || hangDoi.length === 0) {
    console.log('Khong co gi trong hang doi.');
    return;
  }

  console.log(`Tim thay ${hangDoi.length} chuong trong hang doi.`);
  console.log(`Muc song song: ${GIOI_HAN_SONG_SONG} luong.`);
  const batDauTime = Date.now();

  const ketQua = await chayPoolSongSong(
    hangDoi,
    GIOI_HAN_SONG_SONG,
    async (item) => {
      const { chuong_id, truyen_id, so_chuong, so_lan_loi } = item;
      try {
        const { data: chuong, error: loiChuong } = await supabase
          .from('chuong')
          .select('id, so_chuong, tieu_de, noi_dung, audio_url')
          .eq('id', chuong_id)
          .maybeSingle();

        if (loiChuong) {
          throw new Error(`Loi query chuong: ${loiChuong.message}`);
        }
        if (!chuong) {
          throw new Error(`Khong tim thay chuong ID ${chuong_id}`);
        }

        // Neu chuong da co audio_url tu truoc thi xoa khoi hang doi va bao thanh cong
        if (chuong.audio_url && chuong.audio_url.trim() !== '') {
          await supabase.from('hang_doi_audio').delete().eq('chuong_id', chuong_id);
          return {
            thanhCong: true,
            soChuong: chuong.so_chuong,
            truyenId: truyen_id,
            daCoSan: true,
          };
        }

        if (!chuong.noi_dung) {
          throw new Error(`Chuong ${so_chuong} khong co noi dung`);
        }

        const buffer = await taoAudioBuffer(chuong.tieu_de, chuong.noi_dung);
        const publicUrl = await uploadVaCapNhat(supabase, truyen_id, chuong, buffer);
        const mb = (buffer.length / (1024 * 1024)).toFixed(2);

        // Xoa dong khoi hang doi khi da tao thanh cong
        const { error: loiXoa } = await supabase
          .from('hang_doi_audio')
          .delete()
          .eq('chuong_id', chuong_id);

        if (loiXoa) {
          console.error(`Canh bao: Khong the xoa chuong ${so_chuong} khoi hang doi:`, loiXoa.message);
        }

        return {
          thanhCong: true,
          soChuong: chuong.so_chuong,
          truyenId: truyen_id,
          mb,
          publicUrl,
        };
      } catch (err) {
        const loi = err?.message || String(err);
        const soLanLoiMoi = so_lan_loi + 1;
        await supabase
          .from('hang_doi_audio')
          .update({ so_lan_loi: soLanLoiMoi })
          .eq('chuong_id', chuong_id);

        return {
          thanhCong: false,
          soChuong: so_chuong,
          truyenId: truyen_id,
          soLanLoiMoi,
          loi,
        };
      }
    },
    (res, hoanThanh, tong) => {
      if (res.thanhCong) {
        if (res.daCoSan) {
          console.log(`[${hoanThanh}/${tong}] Chuong ${res.soChuong}: Da co audio san, da xoa khoi hang doi.`);
        } else {
          console.log(`[${hoanThanh}/${tong}] Chuong ${res.soChuong}: Tao thanh cong (${res.mb} MB), da xoa khoi hang doi.`);
        }
      } else {
        console.error(
          `[${hoanThanh}/${tong}] Chuong ${res.soChuong}: LOI - ${res.loi}, tang so lan loi len ${res.soLanLoiMoi}.`
        );
      }
    }
  );

  const thoiGianGiay = ((Date.now() - batDauTime) / 1000).toFixed(1);
  const dsThanhCong = ketQua.filter((r) => r.thanhCong);
  const dsLoi = ketQua.filter((r) => !r.thanhCong);

  console.log('\n========================================');
  console.log('TONG KET WORKER AUDIO:');
  console.log(`- Thoi gian chay: ${thoiGianGiay}s`);
  console.log(`- Tong so xu ly: ${ketQua.length}`);
  console.log(`- Thanh cong: ${dsThanhCong.length}`);
  console.log(`- Loi: ${dsLoi.length}`);
  console.log('========================================\n');
}

main();
