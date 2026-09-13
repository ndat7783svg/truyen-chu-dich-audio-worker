'use server';

import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function luuTruyen(truyenId: string) {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { thanhCong: false, canDangNhap: true };

  const { error } = await supabase
    .from('truyen_da_luu')
    .insert({ nguoi_dung_id: user.id, truyen_id: truyenId });
  return { thanhCong: !error, canDangNhap: false };
}

export async function boLuuTruyen(truyenId: string) {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { thanhCong: false, canDangNhap: true };

  const { error } = await supabase
    .from('truyen_da_luu')
    .delete()
    .eq('nguoi_dung_id', user.id)
    .eq('truyen_id', truyenId);
  return { thanhCong: !error, canDangNhap: false };
}
