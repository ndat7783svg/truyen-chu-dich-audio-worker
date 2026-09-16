'use server';

import { cookies } from 'next/headers';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function luuTienDoDoc(truyenId: string, chuongId: string) {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('tien_do_doc').upsert({
    user_id: user.id,
    truyen_id: truyenId,
    chuong_id: chuongId,
    updated_at: new Date().toISOString(),
  });
}

export async function ghiLuotXemChuong(truyenId: string, chuongId: string) {
  try {
    const supabase = await taoSupabaseServerClient();
    const [{ data: { user } }, cookieStore] = await Promise.all([
      supabase.auth.getUser(),
      cookies(),
    ]);

    const khachId = cookieStore.get('khach_id')?.value;
    const visitorKey = user
      ? `nguoidung:${user.id}`
      : khachId
      ? `khach:${khachId}`
      : null;

    if (visitorKey) {
      await supabase.rpc('ghi_luot_xem', {
        p_visitor_key: visitorKey,
        p_chuong_id: chuongId,
        p_truyen_id: truyenId,
      });
    }
  } catch (error) {
    console.error('Lỗi khi ghi lượt xem qua action:', error);
  }
}

