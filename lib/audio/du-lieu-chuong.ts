import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import type { ChuongNguon, QuyenNghe } from './danh-sach-phat';

type HangChuong = { id: string; so_chuong: number; tieu_de: string; noi_dung: string | null };

function sangChuongNguon(h: HangChuong): ChuongNguon {
  return { chuongId: h.id, soChuong: h.so_chuong, tieuDe: h.tieu_de, noiDung: h.noi_dung ?? '' };
}

// Service role: đọc được cột noi_dung (đã bị REVOKE với anon/authenticated). Chỉ dùng trong route server,
// và mọi quyết định "được nghe hay không" phải được kiểm TRƯỚC khi dùng dữ liệu này (xem xay-danh-sach-phat).
export function taoSupabaseDichVu(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const khoa = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !khoa) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, khoa, { auth: { persistSession: false } });
}

export async function layChuongTuSo(
  sb: SupabaseClient,
  truyenId: string,
  tuSoChuong: number,
  soLuong: number
): Promise<ChuongNguon[]> {
  const { data, error } = await sb
    .from('chuong')
    .select('id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyenId)
    .gte('so_chuong', tuSoChuong)
    .order('so_chuong', { ascending: true })
    .limit(soLuong);
  if (error) throw new Error(`Lỗi đọc chương: ${error.message}`);
  return ((data ?? []) as HangChuong[]).map(sangChuongNguon);
}

export async function layMotChuong(
  sb: SupabaseClient,
  truyenId: string,
  soChuong: number
): Promise<ChuongNguon | null> {
  const { data, error } = await sb
    .from('chuong')
    .select('id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyenId)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (error) throw new Error(`Lỗi đọc chương: ${error.message}`);
  return data ? sangChuongNguon(data as HangChuong) : null;
}

// Quyền của NGƯỜI GỌI, lấy từ cookie phiên đăng nhập (Supabase Auth) - không tin bất kỳ tham số nào từ client.
export async function layQuyenNghe(): Promise<QuyenNghe> {
  const sb = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { daDangNhap: false, coVip: false };
  const { data } = await sb.from('nguoi_dung').select('goi_het_han').eq('id', user.id).maybeSingle();
  return { daDangNhap: true, coVip: conHieuLucGoi(data?.goi_het_han ?? null) };
}
