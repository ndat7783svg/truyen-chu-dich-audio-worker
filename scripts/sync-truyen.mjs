#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { taoSlug } from './slug.js';
import { parseChuong } from './parse-chuong.js';

const THU_MUC_GOC =
  process.env.TRANSLATE_TRUYEN_DIR || 'D:\\translate truyen\\danh-sach-truyen';

function docThamSo(argv) {
  const [tenTruyenGoc, ...rest] = argv;
  if (!tenTruyenGoc) {
    console.error(
      'Thieu ten truyen. Cach dung: node sync-truyen.mjs "<Ten truyen>" [--mo-ta "..."] [--anh-bia "URL"]'
    );
    process.exit(1);
  }
  let moTa = null;
  let anhBia = null;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--mo-ta') {
      moTa = rest[i + 1];
      i += 1;
    }
    if (rest[i] === '--anh-bia') {
      anhBia = rest[i + 1];
      i += 1;
    }
  }
  return { tenTruyenGoc, moTa, anhBia };
}

function timThuMucTruyen(tenTruyenGoc) {
  const tatCaThuMuc = readdirSync(THU_MUC_GOC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const timKiem = tenTruyenGoc.toLowerCase();
  const khop = tatCaThuMuc.filter((ten) => ten.toLowerCase().includes(timKiem));

  if (khop.length === 0) {
    console.error(
      `Khong tim thay truyen nao khop "${tenTruyenGoc}". Danh sach hien co:\n- ${tatCaThuMuc.join('\n- ')}`
    );
    process.exit(1);
  }
  if (khop.length > 1) {
    console.error(
      `Khop nhieu hon 1 truyen voi "${tenTruyenGoc}":\n- ${khop.join('\n- ')}\nGo ten chinh xac hon.`
    );
    process.exit(1);
  }
  return khop[0];
}

async function main() {
  const { tenTruyenGoc, moTa, anhBia } = docThamSo(process.argv.slice(2));
  const tenThuMuc = timThuMucTruyen(tenTruyenGoc);
  const slug = taoSlug(tenThuMuc);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thieu bien moi truong SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: truyenRow, error: loiTimTruyen } = await supabase
    .from('truyen')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (loiTimTruyen) {
    console.error('Loi truy van Supabase (tim truyen):', loiTimTruyen.message);
    process.exit(1);
  }

  let truyenId = truyenRow?.id;

  if (!truyenId) {
    if (!moTa) {
      console.error(
        `Truyen "${tenThuMuc}" chua co tren web. Chay lai kem --mo-ta "..." (va --anh-bia "URL" neu co) de tao moi.`
      );
      process.exit(1);
    }
    const { data: truyenMoi, error: loiTao } = await supabase
      .from('truyen')
      .insert({ ten: tenThuMuc, slug, mo_ta: moTa, anh_bia: anhBia })
      .select('id')
      .single();
    if (loiTao) {
      console.error('Loi tao truyen moi:', loiTao.message);
      process.exit(1);
    }
    truyenId = truyenMoi.id;
    console.log(`Da tao truyen moi "${tenThuMuc}" (slug: ${slug}).`);
  }

  const { data: chuongDaCo, error: loiDsChuong } = await supabase
    .from('chuong')
    .select('so_chuong')
    .eq('truyen_id', truyenId);

  if (loiDsChuong) {
    console.error('Loi truy van danh sach chuong:', loiDsChuong.message);
    process.exit(1);
  }
  const soDaCo = new Set((chuongDaCo || []).map((c) => c.so_chuong));

  const thuMucChuong = join(THU_MUC_GOC, tenThuMuc, 'chuong');
  if (!existsSync(thuMucChuong)) {
    console.error(`Khong tim thay thu muc chuong: ${thuMucChuong}`);
    process.exit(1);
  }
  const fileChuong = readdirSync(thuMucChuong).filter((f) => /^chuong-\d{3}\.md$/.test(f));

  const daDang = [];
  const boQua = [];
  for (const tenFile of fileChuong) {
    let thongTin;
    try {
      const noiDungFile = readFileSync(join(thuMucChuong, tenFile), 'utf-8');
      thongTin = parseChuong(tenFile, noiDungFile);
    } catch (err) {
      console.error(`Bo qua file loi dinh dang "${tenFile}": ${err.message}`);
      boQua.push(tenFile);
      continue;
    }
    if (soDaCo.has(thongTin.soChuong)) continue;

    const { error: loiDang } = await supabase.from('chuong').insert({
      truyen_id: truyenId,
      so_chuong: thongTin.soChuong,
      tieu_de: thongTin.tieuDe,
      noi_dung: thongTin.noiDung,
    });
    if (loiDang) {
      console.error(`Loi dang chuong ${thongTin.soChuong}:`, loiDang.message);
      boQua.push(tenFile);
      continue;
    }
    daDang.push(thongTin.soChuong);
  }

  daDang.sort((a, b) => a - b);
  if (daDang.length === 0) {
    console.log(`Khong co chuong moi cho truyen "${tenThuMuc}".`);
  } else {
    console.log(`Da dang ${daDang.length} chuong moi cho "${tenThuMuc}": ${daDang.join(', ')}`);
  }
  if (boQua.length > 0) {
    console.log(`Bo qua ${boQua.length} file loi: ${boQua.join(', ')}`);
  }
}

main();
