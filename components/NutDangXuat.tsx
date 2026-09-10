'use client';

import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';

export default function NutDangXuat() {
  const router = useRouter();

  async function dangXuat() {
    const supabase = taoSupabaseClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button onClick={dangXuat} className="hover:underline">
      Đăng xuất
    </button>
  );
}
