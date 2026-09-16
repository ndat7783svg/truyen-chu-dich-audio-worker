#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import {
  GIONG_DOC,
  damBaoBucketStorage,
  taoAudioBuffer,
  uploadVaCapNhat,
  chayPoolSongSong,
} from './lib/tao-audio-logic.mjs';

const GIOI_HAN_SONG_SONG_MAC_DINH = 20;

function docThamSo(argv) {
  const [tenTruyenGoc, ...rest] = argv;
  if (!tenTruyenGoc) {
    console.error(
      'Thieu ten truyen. Cach dung: node --env-file=.env.local scripts/tao-audio-chuong.mjs "<Ten truyen>" [--gioi-han-song-song N]'
    );
    process.exitCode = 1;
    return null;
  }

  let gioiHanSongSong = GIOI_HAN_SONG_SONG_MAC_DINH;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--gioi-han-song-song' && rest[i + 1]) {
      const parsed = parseInt(rest[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        gioiHanSongSong = parsed;
      }
      i += 1;
    }
  }

  return { tenTruyenGoc, gioiHanSongSong };
}

async function timTruyen(supabase, tenTruyenGoc) {
  const { data: tatCaTruyen, error } = await supabase
    .from('truyen')
    .select('id, ten, slug');

  if (error) {
    console.error('Loi truy van danh sach truyen:', error.message);
    return null;
  }

  const timKiem = tenTruyenGoc.toLowerCase().trim();
  const khop = (tatCaTruyen || []).filter(
    (t) =>
      t.ten.toLowerCase().includes(timKiem) ||
      t.slug.toLowerCase().includes(timKiem)
  );

  if (khop.length === 0) {
    const dsHienCo = (tatCaTruyen || []).map((t) => `- ${t.ten} (${t.slug})`).join('\n');
    console.error(
      `Khong tim thay truyen nao khop "${tenTruyenGoc}". Danh sach truyen hien co tren Supabase:\n${dsHienCo}`
    );
    return null;
  }

  if (khop.length > 1) {
    const dsKhop = khop.map((t) => `- ${t.ten} (${t.slug})`).join('\n');
    console.error(
      `Khop nhieu hon 1 truyen voi "${tenTruyenGoc}":\n${dsKhop}\nGo ten hoac slug chinh xac hon.`
    );
    return null;
  }

  return khop[0];
}

async function layTatCaChuong(supabase, truyenId) {
  const danhSach = [];
  const KICH_THUOC_TRANG = 1000;
  let batDau = 0;

  while (true) {
    const { data, error } = await supabase
      .from('chuong')
      .select('id, so_chuong, tieu_de, noi_dung, audio_url')
      .eq('truyen_id', truyenId)
      .order('so_chuong', { ascending: true })
      .range(batDau, batDau + KICH_THUOC_TRANG - 1);

    if (error) {
      console.error('Loi truy van chuong:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    danhSach.push(...data);
    if (data.length < KICH_THUOC_TRANG) break;
    batDau += KICH_THUOC_TRANG;
  }

  return danhSach;
}

async function xuLyMotChuong(supabase, truyenId, chuong) {
  for (let lanThu = 1; lanThu <= 2; lanThu += 1) {
    try {
      const buffer = await taoAudioBuffer(chuong.tieu_de, chuong.noi_dung);
      const publicUrl = await uploadVaCapNhat(supabase, truyenId, chuong, buffer);
      const mb = (buffer.length / (1024 * 1024)).toFixed(2);
      return {
        thanhCong: true,
        soChuong: chuong.so_chuong,
        mb,
        publicUrl,
      };
    } catch (err) {
      if (lanThu === 1) {
        // Thu lai 1 lan sau 1.5s
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return {
        thanhCong: false,
        soChuong: chuong.so_chuong,
        loi: err?.message || String(err),
      };
    }
  }
}

async function main() {
  const thamSo = docThamSo(process.argv.slice(2));
  if (!thamSo) return;
  const { tenTruyenGoc, gioiHanSongSong } = thamSo;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thieu bien moi truong SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY.');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`Dang tim truyen "${tenTruyenGoc}" tren Supabase...`);
  const truyen = await timTruyen(supabase, tenTruyenGoc);
  if (!truyen) {
    process.exitCode = 1;
    return;
  }
  console.log(`Tim thay truyen: "${truyen.ten}" (ID: ${truyen.id}, Slug: ${truyen.slug}).`);

  await damBaoBucketStorage(supabase);

  console.log(`Dang tai danh sach chuong cua "${truyen.ten}"...`);
  const tatCaChuong = await layTatCaChuong(supabase, truyen.id);
  const tongSoChuong = tatCaChuong.length;

  const chuongDaCo = tatCaChuong.filter((c) => c.audio_url && c.audio_url.trim() !== '');
  const chuongCanTao = tatCaChuong.filter((c) => !c.audio_url || c.audio_url.trim() === '');

  console.log(
    `Tong so chuong: ${tongSoChuong} | Da co audio: ${chuongDaCo.length} | Can tao audio: ${chuongCanTao.length}`
  );
  console.log(`Muc song song: ${gioiHanSongSong} luong | Giong: ${GIONG_DOC}`);

  if (chuongCanTao.length === 0) {
    console.log('Tat ca cac chuong da co audio. Khong can tao them.');
    return;
  }

  console.log(`--- Bat dau tao audio cho ${chuongCanTao.length} chuong ---`);
  const batDauTime = Date.now();

  const ketQua = await chayPoolSongSong(
    chuongCanTao,
    gioiHanSongSong,
    (chuong) => xuLyMotChuong(supabase, truyen.id, chuong),
    (res, hoanThanh, tong) => {
      if (res.thanhCong) {
        console.log(`[${hoanThanh}/${tong}] Chuong ${res.soChuong}: Thanh cong (${res.mb} MB)`);
      } else {
        console.error(`[${hoanThanh}/${tong}] Chuong ${res.soChuong}: LOI - ${res.loi}`);
      }
    }
  );

  const thoiGianGiay = ((Date.now() - batDauTime) / 1000).toFixed(1);
  const dsThanhCong = ketQua.filter((r) => r.thanhCong);
  const dsLoi = ketQua.filter((r) => !r.thanhCong);

  console.log('\n========================================');
  console.log(`TONG KET TAO AUDIO: "${truyen.ten}"`);
  console.log(`- Thoi gian chay: ${thoiGianGiay}s`);
  console.log(`- Tong so chuong cua truyen: ${tongSoChuong}`);
  console.log(`- So chuong da co san (bo qua): ${chuongDaCo.length}`);
  console.log(`- So chuong da tao thanh cong trong dot nay: ${dsThanhCong.length}`);
  console.log(`- So chuong bi loi: ${dsLoi.length}`);

  if (dsLoi.length > 0) {
    const dsSoChuongLoi = dsLoi.map((r) => r.soChuong).sort((a, b) => a - b);
    console.log(`- Danh sach chuong loi: ${dsSoChuongLoi.join(', ')}`);
    console.log('Chi tiet loi:');
    dsLoi.forEach((r) => {
      console.log(`  + Chuong ${r.soChuong}: ${r.loi}`);
    });
  }
  console.log('========================================\n');
}

main();
