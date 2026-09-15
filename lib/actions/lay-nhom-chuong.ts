'use server';

import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { KICH_THUOC_NHOM_CHUONG } from '@/lib/utils/chuong';

export type MucChuong = { soChuong: number; tieuDe: string };

export async function layNhomChuong(truyenId: string, soNhom: number): Promise<MucChuong[]> {
  const supabase = await taoSupabaseServerClient();
  const tuChuong = soNhom * KICH_THUOC_NHOM_CHUONG + 1;
  const denChuong = (soNhom + 1) * KICH_THUOC_NHOM_CHUONG;

  const { data, error } = await supabase
    .from('chuong')
    .select('so_chuong, tieu_de')
    .eq('truyen_id', truyenId)
    .gte('so_chuong', tuChuong)
    .lte('so_chuong', denChuong)
    .order('so_chuong', { ascending: true });

  if (error) {
    throw new Error(`Lỗi tải danh sách chương: ${error.message}`);
  }

  return (data ?? []).map((c) => ({
    soChuong: c.so_chuong,
    tieuDe: c.tieu_de,
  }));
}
