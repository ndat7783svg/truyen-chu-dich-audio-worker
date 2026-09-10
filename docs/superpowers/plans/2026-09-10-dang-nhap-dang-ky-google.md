# Đăng ký/Đăng nhập nâng cấp (Xác nhận Email + Google OAuth) Implementation Plan

> **For agentic workers:** dùng skill `delegate-antigravity-sk` để giao từng Task cho Antigravity
> qua MCP (`use_antigravity`, mode `plan` rồi `accept-edits`), Claude duyệt và tự kiểm tra kết quả
> thật (chạy lệnh, đọc file, mở browser) sau mỗi Task trước khi sang Task kế tiếp — KHÔNG dùng
> `subagent-driven-development`/`executing-plans` chuẩn của superpowers (dự án này ghi đè bằng
> `CLAUDE.md`). Steps dùng checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Nâng cấp toàn bộ hệ thống xác thực của web truyện AI với quy trình xác nhận email thật, đăng nhập Google OAuth một chạm, lưu trữ hồ sơ người dùng trong bảng `public.nguoi_dung` qua Trigger PostgreSQL và hiển thị lời chào cá nhân hóa trên Header.

**Architecture:** Sử dụng kiến trúc Profile Pattern của Supabase tách biệt `auth.users` và `public.nguoi_dung` được đồng bộ qua Trigger `after insert` trong PostgreSQL kèm RLS nghiêm ngặt. Phía Next.js App Router xử lý luồng xác thực PKCE qua Route Handler `app/auth/callback/route.ts` hỗ trợ cả email confirmation và Google OAuth, kết hợp hàm tiện ích dịch mã lỗi Supabase sang tiếng Việt thân thiện với người dùng.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Supabase (Postgres, Auth, RLS, Trigger), @supabase/ssr, Vitest.

## Global Constraints

- Tuân thủ quy tắc an toàn: Không tự động submit form auth thật hoặc tự kích hoạt luồng OAuth trong trình duyệt; bước kiểm thử chức năng auth bắt buộc do người dùng trực tiếp thực hiện.
- Không tự ý chạy migration/SQL vào database Supabase từ terminal/code; các lệnh SQL phải được lưu vào file `supabase/schema.sql` và hướng dẫn người dùng chạy qua Supabase SQL Editor.
- Quy ước đặt tên: Biến, hàm và thuộc tính trong TypeScript/JavaScript dùng `camelCase` (ví dụ: `dichLoiSupabase`, `tenNguoiDung`, `taoSupabaseServerClient`); tên bảng, cột và trigger trong database dùng `snake_case` (ví dụ: `nguoi_dung`, `ten_nguoi_dung`, `tao_ho_so_nguoi_dung`).
- Đọc query params bằng `useSearchParams` trong client component của Next.js App Router phải được bọc trong `<Suspense>` để tránh lỗi de-opt / build failure.
- Next.js fetch cache rule: Đảm bảo dữ liệu tươi mới theo quy tắc toàn cục khi gọi Supabase.
- Giữ giao diện đồng bộ với theme sáng hiện tại, sử dụng SVG inline cho icon Google thay vì tải tài nguyên bên ngoài.

---

### Task 1: Khởi tạo bảng hồ sơ `public.nguoi_dung`, RLS và Trigger trong database

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: Bảng `auth.users` của Supabase Auth
- Produces: Bảng `public.nguoi_dung`, 2 RLS policies, function `tao_ho_so_nguoi_dung()`, trigger `khi_co_tai_khoan_moi`

- [ ] **Bước 1: Cập nhật `supabase/schema.sql` với định nghĩa bảng `nguoi_dung`, RLS và trigger tự động**

Thêm đoạn SQL sau vào cuối file `supabase/schema.sql`:

```sql
-- Đợt C (2026-09-10): Hồ sơ người dùng & trigger tự động tạo hồ sơ
create table if not exists public.nguoi_dung (
  id uuid primary key references auth.users(id) on delete cascade,
  ten_nguoi_dung text,
  tao_luc timestamptz not null default now()
);

alter table public.nguoi_dung enable row level security;

drop policy if exists "nguoi dung xem ho so cua chinh minh" on public.nguoi_dung;
create policy "nguoi dung xem ho so cua chinh minh"
  on public.nguoi_dung for select using (auth.uid() = id);

drop policy if exists "nguoi dung sua ho so cua chinh minh" on public.nguoi_dung;
create policy "nguoi dung sua ho so cua chinh minh"
  on public.nguoi_dung for update using (auth.uid() = id);

create or replace function public.tao_ho_so_nguoi_dung()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nguoi_dung (id, ten_nguoi_dung)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'ten_nguoi_dung',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  );
  return new;
end;
$$;

drop trigger if exists khi_co_tai_khoan_moi on auth.users;
create trigger khi_co_tai_khoan_moi
  after insert on auth.users
  for each row execute function public.tao_ho_so_nguoi_dung();
```

- [ ] **Bước 2: Hướng dẫn người dùng chạy SQL trên Supabase Dashboard**

Yêu cầu người dùng:
1. Mở Supabase Dashboard -> chọn project -> vào mục **SQL Editor**.
2. Dán đoạn mã SQL trên và nhấn **Run** để khởi tạo bảng, RLS policies, function và trigger.
3. Vào mục **Authentication -> Settings** và đảm bảo tuỳ chọn **Confirm email** đang được BẬT (enabled).

---

### Task 2: TDD hàm tiện ích dịch mã lỗi Supabase Auth (`lib/utils/dich-loi-supabase.ts`)

**Files:**
- Create: `lib/utils/dich-loi-supabase.test.ts`
- Create: `lib/utils/dich-loi-supabase.ts`

**Interfaces:**
- Consumes: Chuỗi thông báo lỗi tiếng Anh từ Supabase (`string`)
- Produces: Hàm `dichLoiSupabase(message: string): string` trả về thông báo lỗi tiếng Việt thân thiện

- [ ] **Bước 1: Viết test case cho hàm dịch lỗi Supabase**

Tạo file `lib/utils/dich-loi-supabase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dichLoiSupabase } from './dich-loi-supabase';

describe('dichLoiSupabase', () => {
  it('dịch lỗi Invalid login credentials thành tiếng Việt', () => {
    expect(dichLoiSupabase('Invalid login credentials')).toBe('Email hoặc mật khẩu không đúng.');
  });

  it('dịch lỗi Email not confirmed thành tiếng Việt', () => {
    expect(dichLoiSupabase('Email not confirmed')).toBe(
      'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản.'
    );
  });

  it('dịch lỗi User already registered thành tiếng Việt', () => {
    expect(dichLoiSupabase('User already registered')).toBe('Email này đã được đăng ký.');
  });

  it('trả về câu thông báo chung khi gặp lỗi lạ không có trong danh sách map', () => {
    expect(dichLoiSupabase('Some unknown network error')).toBe('Có lỗi xảy ra, vui lòng thử lại.');
    expect(dichLoiSupabase('')).toBe('Có lỗi xảy ra, vui lòng thử lại.');
  });
});
```

- [ ] **Bước 2: Chạy kiểm thử để xác nhận test FAIL**

Chạy lệnh terminal:
```bash
npm run test
```
Xác nhận test báo lỗi do chưa tạo hàm `dichLoiSupabase`.

- [ ] **Bước 3: Viết implementation cho `lib/utils/dich-loi-supabase.ts`**

Tạo file `lib/utils/dich-loi-supabase.ts`:

```ts
export function dichLoiSupabase(message: string): string {
  if (!message) {
    return 'Có lỗi xảy ra, vui lòng thử lại.';
  }

  const msg = message.toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản.';
  }

  if (msg.includes('user already registered')) {
    return 'Email này đã được đăng ký.';
  }

  return 'Có lỗi xảy ra, vui lòng thử lại.';
}
```

- [ ] **Bước 4: Chạy lại kiểm thử xác nhận test PASS**

Chạy lệnh:
```bash
npm run test
```
Xác nhận tất cả 4 test cases đều chuyển sang màu xanh (PASS).

---

### Task 3: Xây dựng Route Handler Callback PKCE (`app/auth/callback/route.ts`)

**Files:**
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: Query param `code` từ link xác nhận email Supabase hoặc Google OAuth redirect
- Produces: Session đăng nhập Supabase và redirect về `/` hoặc `/dang-nhap?loi=xac-nhan-that-bai`

- [ ] **Bước 1: Viết route handler xử lý trao đổi code lấy session**

Tạo file `app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await taoSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/dang-nhap?loi=xac-nhan-that-bai`);
}
```

---

### Task 4: Viết lại toàn bộ trang Đăng ký (`app/dang-ky/page.tsx`)

**Files:**
- Modify: `app/dang-ky/page.tsx`

**Interfaces:**
- Consumes: `dichLoiSupabase` từ `@/lib/utils/dich-loi-supabase`, `taoSupabaseClient` từ `@/lib/supabase/client`
- Produces: Giao diện form đăng ký với trường Tên người dùng, Email, Mật khẩu, Xác nhận mật khẩu, nút Google OAuth, và màn hình thông báo kiểm tra email khi thành công

- [ ] **Bước 1: Viết lại component `TrangDangKy`**

Ghi đè nội dung file `app/dang-ky/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { taoSupabaseClient } from '@/lib/supabase/client';
import { dichLoiSupabase } from '@/lib/utils/dich-loi-supabase';

export default function TrangDangKy() {
  const [tenNguoiDung, setTenNguoiDung] = useState('');
  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [xacNhanMatKhau, setXacNhanMatKhau] = useState('');
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangKyThanhCong, setDangKyThanhCong] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);

    if (matKhau !== xacNhanMatKhau) {
      setLoi('Mật khẩu xác nhận không khớp');
      return;
    }

    setDangXuLy(true);
    try {
      const supabase = taoSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email,
        password: matKhau,
        options: {
          data: {
            ten_nguoi_dung: tenNguoiDung,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setLoi(dichLoiSupabase(error.message));
        return;
      }

      setDangKyThanhCong(true);
    } catch {
      setLoi('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setDangXuLy(false);
    }
  }

  async function dangNhapGoogle() {
    setLoi(null);
    try {
      const supabase = taoSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setLoi('Không thể đăng nhập bằng Google lúc này, vui lòng thử lại sau.');
      }
    } catch {
      setLoi('Không thể đăng nhập bằng Google lúc này, vui lòng thử lại sau.');
    }
  }

  if (dangKyThanhCong) {
    return (
      <main className="w-full max-w-md mx-auto p-6 bg-white border border-gray-200 rounded-lg shadow-sm mt-8">
        <h1 className="text-2xl font-bold mb-4 text-green-700">Đăng ký thành công!</h1>
        <p className="text-gray-700 leading-relaxed mb-6">
          Vui lòng kiểm tra email <strong className="font-semibold">{email}</strong> để xác nhận tài khoản trước khi đăng nhập.
        </p>
        <Link
          href="/dang-nhap"
          className="inline-block text-blue-600 hover:underline font-medium"
        >
          Về trang đăng nhập &rarr;
        </Link>
      </main>
    );
  }

  return (
    <main className="w-full max-w-md mx-auto p-6 bg-white border border-gray-200 rounded-lg shadow-sm mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Đăng ký tài khoản</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tên người dùng
          </label>
          <input
            type="text"
            required
            value={tenNguoiDung}
            onChange={(e) => setTenNguoiDung(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn A"
            className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu (tối thiểu 6 ký tự)
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            placeholder="••••••••"
            className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Xác nhận mật khẩu
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={xacNhanMatKhau}
            onChange={(e) => setXacNhanMatKhau(e.target.value)}
            placeholder="••••••••"
            className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loi && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {loi}
          </div>
        )}

        <button
          type="submit"
          disabled={dangXuLy}
          className="w-full py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50"
        >
          {dangXuLy ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Hoặc tiếp tục với</span>
        </div>
      </div>

      <button
        type="button"
        onClick={dangNhapGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 font-medium transition shadow-sm"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Google</span>
      </button>

      <p className="mt-6 text-center text-sm text-gray-600">
        Đã có tài khoản?{' '}
        <Link href="/dang-nhap" className="text-blue-600 hover:underline font-medium">
          Đăng nhập ngay
        </Link>
      </p>
    </main>
  );
}
```

---

### Task 5: Cập nhật trang Đăng nhập (`app/dang-nhap/page.tsx`)

**Files:**
- Modify: `app/dang-nhap/page.tsx`

**Interfaces:**
- Consumes: Query params `loi` qua `useSearchParams`, `dichLoiSupabase` từ `@/lib/utils/dich-loi-supabase`, `taoSupabaseClient` từ `@/lib/supabase/client`
- Produces: Giao diện đăng nhập hỗ trợ hiển thị lỗi callback, dịch lỗi Supabase và nút Google OAuth bọc trong `<Suspense>`

- [ ] **Bước 1: Cập nhật component `TrangDangNhap`**

Sửa file `app/dang-nhap/page.tsx`:

```tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { taoSupabaseClient } from '@/lib/supabase/client';
import { dichLoiSupabase } from '@/lib/utils/dich-loi-supabase';

function FormDangNhap() {
  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const [dangXuLy, setDangXuLy] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const maLoi = searchParams.get('loi');
    if (maLoi === 'xac-nhan-that-bai') {
      setLoi('Xác nhận thất bại hoặc đường dẫn đã hết hạn, vui lòng thử lại.');
    }
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    setDangXuLy(true);

    try {
      const supabase = taoSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: matKhau,
      });

      if (error) {
        setLoi(dichLoiSupabase(error.message));
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setLoi('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setDangXuLy(false);
    }
  }

  async function dangNhapGoogle() {
    setLoi(null);
    try {
      const supabase = taoSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setLoi('Không thể đăng nhập bằng Google lúc này, vui lòng thử lại sau.');
      }
    } catch {
      setLoi('Không thể đăng nhập bằng Google lúc này, vui lòng thử lại sau.');
    }
  }

  return (
    <main className="w-full max-w-md mx-auto p-6 bg-white border border-gray-200 rounded-lg shadow-sm mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Đăng nhập</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu
          </label>
          <input
            type="password"
            required
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            placeholder="••••••••"
            className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loi && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {loi}
          </div>
        )}

        <button
          type="submit"
          disabled={dangXuLy}
          className="w-full py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50"
        >
          {dangXuLy ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Hoặc tiếp tục với</span>
        </div>
      </div>

      <button
        type="button"
        onClick={dangNhapGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 font-medium transition shadow-sm"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Google</span>
      </button>

      <p className="mt-6 text-center text-sm text-gray-600">
        Chưa có tài khoản?{' '}
        <Link href="/dang-ky" className="text-blue-600 hover:underline font-medium">
          Đăng ký ngay
        </Link>
      </p>
    </main>
  );
}

export default function TrangDangNhap() {
  return (
    <Suspense fallback={<div className="text-center p-8">Đang tải...</div>}>
      <FormDangNhap />
    </Suspense>
  );
}
```

---

### Task 6: Cập nhật Header hiển thị tên người dùng (`components/Header.tsx`)

**Files:**
- Modify: `components/Header.tsx`

**Interfaces:**
- Consumes: Bảng `public.nguoi_dung` qua `supabase.from('nguoi_dung')`
- Produces: Header hiển thị "Xin chào, {ten_nguoi_dung}" hoặc "Xin chào" khi người dùng đã đăng nhập

- [ ] **Bước 1: Sửa `components/Header.tsx` để truy vấn tên người dùng từ bảng `nguoi_dung`**

Cập nhật `components/Header.tsx`:

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import NutDangXuat from './NutDangXuat';
import DropdownTheLoai from './DropdownTheLoai';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tenNguoiDung: string | null = null;
  if (user) {
    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('ten_nguoi_dung')
      .eq('id', user.id)
      .maybeSingle();

    tenNguoiDung = hoSo?.ten_nguoi_dung ?? null;
  }

  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="w-full max-w-3xl mx-auto p-4 flex justify-between items-center">
      <Link href="/" className="font-bold">
        Truyện dịch AI
      </Link>
      <nav className="flex items-center gap-4">
        <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-700">
                Xin chào{tenNguoiDung ? `, ${tenNguoiDung}` : ''}
              </span>
              <NutDangXuat />
            </>
          ) : (
            <>
              <Link href="/dang-nhap" className="hover:underline">
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className="hover:underline">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
```

---

### Task 7: Kiểm thử tự động & Bàn giao 7 kịch bản kiểm thử thủ công cho người dùng

**Files:**
- None (Kiểm tra toàn bộ hệ thống qua lệnh và hướng dẫn)

**Interfaces:**
- Consumes: Bộ mã nguồn và test suite
- Produces: Xác nhận build/test xanh và kết quả kiểm thử thực tế từ người dùng

- [ ] **Bước 1: Chạy toàn bộ test tự động và kiểm tra build Next.js**

Chạy lệnh kiểm thử tự động:
```bash
npm run test
```
Đảm bảo tất cả các test suite vượt qua.

Chạy lệnh build ứng dụng để kiểm tra Type check và linting:
```bash
npm run build
```
Đảm bảo bản build Next.js thành công không có lỗi type hoặc Suspense boundary.

- [ ] **Bước 2: Hướng dẫn người dùng tự thực hiện 7 kịch bản kiểm thử thủ công**

> **Lưu ý quan trọng:** Theo quy tắc an toàn của dự án, Claude/Antigravity **KHÔNG** tự động submit form đăng ký/đăng nhập thật trên trình duyệt. Người dùng tự mở trình duyệt và thực hiện theo 7 kịch bản sau:

1. **Đăng ký bằng email/mật khẩu mới:**
   - Truy cập `/dang-ky`, nhập Tên người dùng, Email thật, Mật khẩu, Xác nhận mật khẩu và nhấn Đăng ký.
   - Thấy thông báo "Đăng ký thành công! Vui lòng kiểm tra email...", **không** bị chuyển hướng vào trang chủ ngay.
   - Kiểm tra Supabase Dashboard -> Table Editor -> `nguoi_dung`: có dòng mới với `ten_nguoi_dung` đúng như đã nhập.

2. **Thử đăng nhập khi chưa xác nhận email:**
   - Vào `/dang-nhap`, nhập email và mật khẩu vừa đăng ký ở bước 1.
   - Thấy thông báo lỗi hiển thị: "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản."

3. **Bấm link xác nhận trong email:**
   - Mở hộp thư email, bấm vào đường link xác nhận do Supabase gửi.
   - Trình duyệt điều hướng về `/auth/callback` rồi về thẳng trang chủ `/`.
   - Header hiển thị: "Xin chào, {tên người dùng}" và nút Đăng xuất.

4. **Đăng xuất và đăng nhập lại:**
   - Nhấn nút "Đăng xuất" trên Header -> quay về trạng thái chưa đăng nhập.
   - Vào lại `/dang-nhap`, đăng nhập bằng email và mật khẩu đã xác nhận.
   - Đăng nhập thành công vào trang chủ, không còn thông báo lỗi xác nhận.

5. **Đăng nhập một chạm bằng Google OAuth:**
   - Vào `/dang-nhap` (hoặc `/dang-ky`), bấm nút "Google".
   - Trình duyệt chuyển sang màn hình chọn tài khoản Google -> Chọn tài khoản.
   - Được chuyển hướng về trang chủ ở trạng thái đã đăng nhập.
   - Kiểm tra Supabase Dashboard -> Table Editor -> `nguoi_dung`: có dòng mới với `ten_nguoi_dung` lấy đúng tên hiển thị từ Google.

6. **Kiểm tra nhập sai mật khẩu:**
   - Vào `/dang-nhap`, nhập email đúng nhưng gõ sai mật khẩu.
   - Thấy thông báo lỗi: "Email hoặc mật khẩu không đúng."

7. **Kiểm tra đăng ký trùng email:**
   - Vào `/dang-ky`, thử đăng ký lại bằng email đã tồn tại trong hệ thống.
   - Thấy thông báo lỗi: "Email này đã được đăng ký."

---

## Self-review

- **Bao phủ spec:** Toàn bộ các yêu cầu từ thiết kế `docs/superpowers/specs/2026-09-10-dang-nhap-dang-ky-google-design.md` đã được chuyển hoá chi tiết vào 7 Task (SQL bảng `nguoi_dung` + trigger, TDD `dichLoiSupabase`, Route Callback PKCE, Viết lại `TrangDangKy`, Sửa `TrangDangNhap` với `<Suspense>`, Sửa `Header` query `nguoi_dung`, Kiểm thử tự động & bàn giao kiểm thử thủ công).
- **Tính trọn vẹn của mã:** Không chứa bất kỳ placeholder, TODO, hay đoạn mã lược dịch "tương tự Task N" nào. Mọi file đều có code hoàn chỉnh và sẵn sàng triển khai.
- **Tính nhất quán danh xưng và biến:**
  - TypeScript/JavaScript (camelCase): `dichLoiSupabase`, `tenNguoiDung`, `xacNhanMatKhau`, `dangKyThanhCong`, `taoSupabaseServerClient`, `taoSupabaseClient`.
  - Database PostgreSQL / Supabase (snake_case): bảng `nguoi_dung`, cột `ten_nguoi_dung`, `tao_luc`, hàm `tao_ho_so_nguoi_dung()`, trigger `khi_co_tai_khoan_moi`, metadata `options.data.ten_nguoi_dung`.
- **Đúng định dạng và quy chuẩn:** Tuân thủ cấu trúc header và định dạng task bắt buộc theo yêu cầu.
