'use server';

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
