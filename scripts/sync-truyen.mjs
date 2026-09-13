#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { taoSlug } from './slug.js';
import { parseChuong } from './parse-chuong.js';
import { parseThongTin } from './parse-thong-tin.js';
import { laySoChuongTuTieuDe, kiemTraTinhLienTuc } from './kiem-tra-chuong.js';

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

function docThongTin(tenThuMuc) {
  const thuMucThongTin = join(THU_MUC_GOC, tenThuMuc, 'thong-tin');
  const fileThongTin = join(thuMucThongTin, 'thong-tin.md');
  const fileAnhBia = join(thuMucThongTin, 'anh-bia.jpg');

  const parsed = existsSync(fileThongTin)
    ? parseThongTin(readFileSync(fileThongTin, 'utf-8'))
    : null;
  const duongDanAnhBia = existsSync(fileAnhBia) ? fileAnhBia : null;

  return { parsed, duongDanAnhBia };
}

async function uploadAnhBia(supabase, slug, duongDanFileAnh) {
  const bytes = readFileSync(duongDanFileAnh);
  const { error } = await supabase.storage
    .from('anh-bia')
    .upload(`${slug}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    console.error('Loi upload anh bia:', error.message);
    process.exit(1);
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from('anh-bia').getPublicUrl(`${slug}.jpg`);
  // Them hau to phien ban de bat trinh duyet/Next.js Image cache coi la anh moi
  // moi khi anh bia duoc thay the (URL goc giu nguyen ten file do dung upsert).
  return `${publicUrl}?v=${Date.now()}`;
}

async function upsertTheLoai(supabase, tenTheLoai) {
  const slugTheLoai = taoSlug(tenTheLoai);
  const { data: hienCo, error: loiTim } = await supabase
    .from('the_loai')
    .select('id')
    .eq('slug', slugTheLoai)
    .maybeSingle();
  if (loiTim) {
    console.error(`Loi truy van the loai "${tenTheLoai}":`, loiTim.message);
    process.exit(1);
  }
  if (hienCo) return hienCo.id;

  const { data: moi, error: loiTao } = await supabase
    .from('the_loai')
    .insert({ ten: tenTheLoai, slug: slugTheLoai })
    .select('id')
    .single();
  if (loiTao) {
    console.error(`Loi tao the loai "${tenTheLoai}":`, loiTao.message);
    process.exit(1);
  }
  return moi.id;
}

async function ganTheLoai(supabase, truyenId, dsTenTheLoai) {
  for (const ten of dsTenTheLoai) {
    const theLoaiId = await upsertTheLoai(supabase, ten);
    const { error } = await supabase
      .from('truyen_the_loai')
      .upsert(
        { truyen_id: truyenId, the_loai_id: theLoaiId },
        { onConflict: 'truyen_id,the_loai_id', ignoreDuplicates: true }
      );
    if (error) {
      console.error(`Loi gan the loai "${ten}":`, error.message);
      process.exit(1);
    }
  }
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

  const { parsed: thongTin, duongDanAnhBia } = docThongTin(tenThuMuc);

  let anhBiaMoi = null;
  if (duongDanAnhBia) {
    anhBiaMoi = await uploadAnhBia(supabase, slug, duongDanAnhBia);
    console.log(`Da upload anh bia cho "${tenThuMuc}".`);
  } else if (thongTin) {
    console.log(`Canh bao: co thong-tin.md nhung thieu anh-bia.jpg cho "${tenThuMuc}".`);
  }

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
    const moTaCuoiCung = thongTin?.moTa ?? moTa;
    if (!moTaCuoiCung) {
      console.error(
        `Truyen "${tenThuMuc}" chua co tren web va khong tim thay thong-tin/thong-tin.md. Chay lai kem --mo-ta "..." de tao moi.`
      );
      process.exit(1);
    }
    const { data: truyenMoi, error: loiTao } = await supabase
      .from('truyen')
      .insert({
        ten: tenThuMuc,
        slug,
        mo_ta: moTaCuoiCung,
        anh_bia: anhBiaMoi ?? anhBia,
        tac_gia: thongTin?.tacGia ?? null,
        ...(thongTin?.trangThai ? { trang_thai: thongTin.trangThai } : {}),
      })
      .select('id')
      .single();
    if (loiTao) {
      console.error('Loi tao truyen moi:', loiTao.message);
      process.exit(1);
    }
    truyenId = truyenMoi.id;
    console.log(`Da tao truyen moi "${tenThuMuc}" (slug: ${slug}).`);
  } else if (thongTin) {
    const capNhat = {};
    if (thongTin.moTa) capNhat.mo_ta = thongTin.moTa;
    if (thongTin.tacGia) capNhat.tac_gia = thongTin.tacGia;
    if (thongTin.trangThai) capNhat.trang_thai = thongTin.trangThai;
    if (anhBiaMoi) capNhat.anh_bia = anhBiaMoi;

    if (Object.keys(capNhat).length > 0) {
      const { error: loiCapNhat } = await supabase
        .from('truyen')
        .update(capNhat)
        .eq('id', truyenId);
      if (loiCapNhat) {
        console.error('Loi cap nhat metadata truyen:', loiCapNhat.message);
        process.exit(1);
      }
      console.log(`Da cap nhat metadata (${Object.keys(capNhat).join(', ')}) cho "${tenThuMuc}".`);
    }
  }

  if (thongTin?.theLoai?.length) {
    await ganTheLoai(supabase, truyenId, thongTin.theLoai);
    console.log(`Da gan the loai: ${thongTin.theLoai.join(', ')}.`);
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

  const danhSachKiemTra = [];
  const daDang = [];
  const boQua = [];
  for (const tenFile of fileChuong) {
    let thongTinChuong;
    try {
      const noiDungFile = readFileSync(join(thuMucChuong, tenFile), 'utf-8');
      thongTinChuong = parseChuong(tenFile, noiDungFile);
      const dongDauTien = (noiDungFile.split('\n')[0] || '').trim();
      danhSachKiemTra.push({
        soChuongFile: thongTinChuong.soChuong,
        soChuongTieuDe: laySoChuongTuTieuDe(dongDauTien),
      });
    } catch (err) {
      console.error(`Bo qua file loi dinh dang "${tenFile}": ${err.message}`);
      boQua.push(tenFile);
      continue;
    }
    if (soDaCo.has(thongTinChuong.soChuong)) continue;

    const { error: loiDang } = await supabase.from('chuong').insert({
      truyen_id: truyenId,
      so_chuong: thongTinChuong.soChuong,
      tieu_de: thongTinChuong.tieuDe,
      noi_dung: thongTinChuong.noiDung,
    });
    if (loiDang) {
      console.error(`Loi dang chuong ${thongTinChuong.soChuong}:`, loiDang.message);
      boQua.push(tenFile);
      continue;
    }
    daDang.push(thongTinChuong.soChuong);
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

  const { thieu, lechTieuDe, tongSo, min, max } = kiemTraTinhLienTuc(danhSachKiemTra);
  console.log(`--- Kiem tra tinh lien tuc so chuong (${tongSo} file, tu ${min} den ${max}) ---`);
  if (thieu.length === 0) {
    console.log('Khong phat hien thieu chuong nao trong khoang tren.');
  } else {
    console.log(`CANH BAO: thieu ${thieu.length} chuong trong khoang tren: ${thieu.join(', ')}`);
  }
  if (lechTieuDe.length > 0) {
    console.log(
      `CANH BAO: ${lechTieuDe.length} file co so chuong trong tieu de khac ten file (nghi trung/nham so): ` +
        lechTieuDe.map((l) => `file ${l.soChuongFile} ghi tieu de Chuong ${l.soChuongTieuDe}`).join('; ')
    );
  }
}

main();
