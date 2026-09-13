#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { tinhHanMoi, SO_NGAY_THEO_GOI, TEN_GOI } from './xac-nhan-thanh-toan-logic.js';

async function main() {
  const maGiaoDich = process.argv[2];
  if (!maGiaoDich) {
    console.error(
      'Thieu ma giao dich. Cach dung: node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <MA_GIAO_DICH>'
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thieu bien moi truong NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: giaoDich, error: loiTimGiaoDich } = await supabase
    .from('giao_dich')
    .select('id, nguoi_dung_id, goi_loai, so_tien, trang_thai')
    .eq('ma_giao_dich', maGiaoDich)
    .maybeSingle();

  if (loiTimGiaoDich) {
    console.error('Loi truy van giao dich:', loiTimGiaoDich.message);
    process.exit(1);
  }
  if (!giaoDich) {
    console.error(`Khong tim thay giao dich voi ma "${maGiaoDich}".`);
    process.exit(1);
  }
  if (giaoDich.trang_thai === 'da_thanh_toan') {
    console.warn(`Giao dich "${maGiaoDich}" da duoc xu ly truoc do. Khong lam gi them.`);
    process.exit(0);
  }

  const soNgay = SO_NGAY_THEO_GOI[giaoDich.goi_loai];
  if (!soNgay) {
    console.error(`Goi khong hop le trong giao dich: "${giaoDich.goi_loai}".`);
    process.exit(1);
  }

  const hanMoi = tinhHanMoi(soNgay);

  const { error: loiUpdateGiaoDich } = await supabase
    .from('giao_dich')
    .update({ trang_thai: 'da_thanh_toan', thanh_toan_luc: new Date().toISOString() })
    .eq('id', giaoDich.id);
  if (loiUpdateGiaoDich) {
    console.error('Loi cap nhat giao dich:', loiUpdateGiaoDich.message);
    process.exit(1);
  }

  const { data: nguoiDung, error: loiUpdateNguoiDung } = await supabase
    .from('nguoi_dung')
    .update({ goi_loai: giaoDich.goi_loai, goi_het_han: hanMoi.toISOString() })
    .eq('id', giaoDich.nguoi_dung_id)
    .select('ten_nguoi_dung')
    .maybeSingle();
  if (loiUpdateNguoiDung) {
    console.error('Loi nang cap tai khoan:', loiUpdateNguoiDung.message);
    process.exit(1);
  }

  console.log('Da nang cap thanh cong.');
  console.log(`Nguoi dung: ${nguoiDung?.ten_nguoi_dung ?? giaoDich.nguoi_dung_id}`);
  console.log(`Goi: ${TEN_GOI[giaoDich.goi_loai]}`);
  console.log(`Het han moi: ${hanMoi.toLocaleString('vi-VN')}`);
}

main();
