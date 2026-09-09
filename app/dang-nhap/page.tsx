'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { taoSupabaseClient } from '@/lib/supabase/client';

export default function TrangDangNhap() {
  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    const supabase = taoSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: matKhau });
    if (error) {
      setLoi(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="w-full max-w-sm mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Đăng nhập</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border rounded px-3 py-2 w-full bg-transparent"
        />
        <input
          type="password"
          required
          value={matKhau}
          onChange={(e) => setMatKhau(e.target.value)}
          placeholder="Mật khẩu"
          className="border rounded px-3 py-2 w-full bg-transparent"
        />
        {loi && <p className="text-red-600 text-sm">{loi}</p>}
        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white w-full">
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
