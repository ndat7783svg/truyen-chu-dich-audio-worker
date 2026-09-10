# Đợt B: Lượt xem truyện — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng skill `delegate-antigravity-sk` để giao từng
> Task cho Antigravity qua MCP (`use_antigravity`, mode `plan` rồi `accept-edits`), Claude duyệt và
> tự kiểm tra kết quả thật (chạy lệnh, đọc file, mở browser) sau mỗi Task trước khi sang Task kế
> tiếp — KHÔNG dùng `subagent-driven-development`/`executing-plans` chuẩn của superpowers (dự án
> này ghi đè bằng `CLAUDE.md`). Steps dùng checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Đếm và hiển thị lượt xem cho từng chương và từng bộ truyện một cách chính xác với cơ chế chống trùng nghiêm ngặt (mỗi visitor chỉ tính 1 lượt xem duy nhất cho 1 chương mãi mãi trong suốt vòng đời, đọc lại không tăng thêm; lượt xem truyện = tổng lượt đọc chương cộng dồn), hiển thị số lượt xem rút gọn đẹp mắt (`12.5K`, `3.4M`) trên thẻ truyện (trang chủ, trang thể loại) và trang chi tiết truyện.

**Architecture:** Mở rộng schema Supabase (thêm cột `truyen.luot_xem`, cột `chuong.luot_xem`, bảng dedup `luot_xem_da_doc` với primary key kép `(visitor_key, chuong_id)`, hàm RPC Postgres `ghi_luot_xem` xử lý dedup nguyên tử qua `ON CONFLICT DO NOTHING` và `IF FOUND` để tăng counter cả `chuong.luot_xem` lẫn `truyen.luot_xem`). Next.js Edge Middleware cấp cookie định danh khách `khach_id` (UUIDv4, `httpOnly`, `SameSite=Lax`, `maxAge=2 năm`). Server Component tại trang đọc chương gọi RPC với `p_visitor_key` (`nguoidung:<user_id>` nếu đã đăng nhập, ngược lại `khach:<khach_id>`), bọc `try/catch` không chặn render nội dung. Hàm format rút gọn `dinhDangSoRutGon` (hậu tố `K`, `M` hoa) được TDD với Vitest. Giao diện `TheTruyen.tsx` và `app/truyen/[slug]/page.tsx` hiển thị icon con mắt + số lượt xem.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres Database, RLS, RPC Function, Auth), Vitest, Tailwind CSS v4, TypeScript.

## Global Constraints

- Định danh biến/hàm cho logic domain dùng tiếng Việt không dấu kiểu camelCase (`dinhDangSoRutGon`, `ghiLuotXem`, `khachId`...).
- Mọi bảng Postgres mới bật RLS; bảng `luot_xem_da_doc` không cấp quyền select/insert/update/delete trực tiếp cho role `anon` / `authenticated`. Chỉ truy cập thông qua hàm Postgres RPC `ghi_luot_xem` định nghĩa với `security definer`.
- Không dùng Supabase CLI/migrations — SQL mới được ghi vào `supabase/schema.sql` (file tích luỹ toàn bộ schema) và user thực thi thủ công qua Supabase Dashboard → SQL Editor.
- Chạy test tự động bằng lệnh `npm run test` (hoặc `npx vitest run`).
- Next.js 16 App Router, Tailwind v4; không thêm class `dark:` trong Đợt B vì chưa hoàn thành Dark Mode toàn diện.
- Đảm bảo hiệu năng & tính sẵn sàng: gọi RPC ghi lượt xem trong Server Component `app/truyen/[slug]/chuong/[so]/page.tsx` phải được bọc trong `try / catch` an toàn, lỗi ghi log không làm crash hoặc chặn render nội dung chương truyện.

---

### Task 1: DB schema — cột `truyen.luot_xem`, cột `chuong.luot_xem`, bảng `luot_xem_da_doc`, RPC `ghi_luot_xem`

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Cột `truyen.luot_xem integer not null default 0`.
- Cột `chuong.luot_xem integer not null default 0`.
- Bảng `luot_xem_da_doc(visitor_key text, chuong_id uuid references chuong(id) on delete cascade, tao_luc timestamptz default now(), primary key (visitor_key, chuong_id))`.
- Hàm RPC `ghi_luot_xem(p_visitor_key text, p_chuong_id uuid, p_truyen_id uuid) returns void` (chế độ `security definer`, `set search_path = public`).

- [ ] **Step 1: Thêm SQL mới vào cuối file `supabase/schema.sql`**

Nối thêm đoạn SQL sau vào cuối file `supabase/schema.sql`:

```sql

-- Đợt B (2026-09-10): Lượt xem truyện & chương
alter table truyen add column if not exists luot_xem integer not null default 0;
alter table chuong add column if not exists luot_xem integer not null default 0;

create table if not exists luot_xem_da_doc (
  visitor_key text not null,
  chuong_id uuid not null references chuong(id) on delete cascade,
  tao_luc timestamptz not null default now(),
  primary key (visitor_key, chuong_id)
);

alter table luot_xem_da_doc enable row level security;

-- Hàm RPC ghi nhận lượt xem nguyên tử, chống trùng vĩnh viễn theo visitor_key + chuong_id
create or replace function ghi_luot_xem(
  p_visitor_key text,
  p_chuong_id uuid,
  p_truyen_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into luot_xem_da_doc (visitor_key, chuong_id)
  values (p_visitor_key, p_chuong_id)
  on conflict (visitor_key, chuong_id) do nothing;

  -- Chỉ tăng số đếm nếu insert ở trên thực sự tạo ra dòng mới (chưa từng đọc chương này)
  if found then
    update chuong
    set luot_xem = luot_xem + 1
    where id = p_chuong_id;

    update truyen
    set luot_xem = luot_xem + 1
    where id = p_truyen_id;
  end if;
end;
$$;
```

- [ ] **Step 2: Hướng dẫn user chạy SQL trên Supabase Dashboard**

Yêu cầu user copy toàn bộ đoạn SQL của Đợt B ở Step 1, truy cập Supabase Dashboard → chọn project → menu **SQL Editor** → tạo query mới, dán vào và bấm **Run**.

Kiểm tra: Query báo `Success. No rows returned`.

---

### Task 2: Hàm tiện ích `dinhDangSoRutGon` (TDD)

**Files:**
- Create: `lib/utils/format.test.ts`
- Create: `lib/utils/format.ts`

**Interfaces:**
- Hàm `dinhDangSoRutGon(so: number | null | undefined): string`
  - Đầu vào `null`, `undefined`, `< 0`, `NaN`: trả về `'0'`
  - `< 1000`: trả về nguyên số dạng chuỗi (ví dụ: `0` → `'0'`, `842` → `'842'`, `999` → `'999'`)
  - `1000` đến `< 1000000`: định dạng `K` (1 chữ số thập phân nếu có phần dư, bỏ `.0` nếu tròn, ví dụ: `1000` → `'1K'`, `12000` → `'12K'`, `12500` → `'12.5K'`, `999900` → `'999.9K'`)
  - `1000000` trở lên: định dạng `M` (1 chữ số thập phân nếu có phần dư, bỏ `.0` nếu tròn, ví dụ: `1000000` → `'1M'`, `3400000` → `'3.4M'`, `10500000` → `'10.5M'`)

- [ ] **Step 1: Viết test suite cho `dinhDangSoRutGon`**

Tạo file `lib/utils/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { dinhDangSoRutGon } from './format';

describe('dinhDangSoRutGon', () => {
  it('xử lý giá trị null, undefined hoặc số âm', () => {
    expect(dinhDangSoRutGon(null)).toBe('0');
    expect(dinhDangSoRutGon(undefined)).toBe('0');
    expect(dinhDangSoRutGon(-5)).toBe('0');
  });

  it('giữ nguyên định dạng số dưới 1.000', () => {
    expect(dinhDangSoRutGon(0)).toBe('0');
    expect(dinhDangSoRutGon(50)).toBe('50');
    expect(dinhDangSoRutGon(842)).toBe('842');
    expect(dinhDangSoRutGon(999)).toBe('999');
  });

  it('rút gọn số từ 1.000 đến dưới 1.000.000 dạng K', () => {
    expect(dinhDangSoRutGon(1000)).toBe('1K');
    expect(dinhDangSoRutGon(1050)).toBe('1.1K');
    expect(dinhDangSoRutGon(1200)).toBe('1.2K');
    expect(dinhDangSoRutGon(12000)).toBe('12K');
    expect(dinhDangSoRutGon(12500)).toBe('12.5K');
    expect(dinhDangSoRutGon(15400)).toBe('15.4K');
    expect(dinhDangSoRutGon(999900)).toBe('999.9K');
  });

  it('rút gọn số từ 1.000.000 trở lên dạng M', () => {
    expect(dinhDangSoRutGon(1000000)).toBe('1M');
    expect(dinhDangSoRutGon(1200000)).toBe('1.2M');
    expect(dinhDangSoRutGon(3400000)).toBe('3.4M');
    expect(dinhDangSoRutGon(10500000)).toBe('10.5M');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test FAIL (Red)**

Chạy lệnh trong terminal:
```bash
npm run test
```
Xác nhận test lỗi do chưa có file `lib/utils/format.ts` hoặc hàm chưa được cài đặt.

- [ ] **Step 3: Cài đặt hàm `dinhDangSoRutGon` trong `lib/utils/format.ts`**

Tạo file `lib/utils/format.ts`:

```typescript
/**
 * Rút gọn số hiển thị cho lượt xem, theo dõi, đánh giá
 * Ví dụ: 842 -> "842", 12500 -> "12.5K", 12000 -> "12K", 3400000 -> "3.4M"
 */
export function dinhDangSoRutGon(so: number | null | undefined): string {
  if (so === null || so === undefined || so < 0 || isNaN(so)) {
    return '0';
  }

  if (so < 1000) {
    return Math.floor(so).toString();
  }

  if (so < 1000000) {
    const giaTriK = so / 1000;
    const dinhDang = giaTriK.toFixed(1);
    return dinhDang.endsWith('.0') ? `${Math.floor(giaTriK)}K` : `${dinhDang}K`;
  }

  const giaTriM = so / 1000000;
  const dinhDang = giaTriM.toFixed(1);
  return dinhDang.endsWith('.0') ? `${Math.floor(giaTriM)}M` : `${dinhDang}M`;
}
```

- [ ] **Step 4: Chạy lại test để xác nhận test PASS (Green)**

Chạy lệnh trong terminal:
```bash
npm run test
```
Xác nhận toàn bộ test trong `lib/utils/format.test.ts` đều PASS.

---

### Task 3: Middleware cấp cookie `khach_id` cho khách vãng lai

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Đọc cookie `khach_id` từ request. Nếu chưa có, sinh UUID mới bằng `crypto.randomUUID()`.
- Thiết lập cookie `khach_id` trên response với: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 60 * 60 * 24 * 365 * 2` (2 năm), `secure: process.env.NODE_ENV === 'production'`.

- [ ] **Step 1: Cập nhật `middleware.ts`**

Chỉnh sửa file `middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // 1. Kiểm tra và cấp cookie khach_id nếu chưa tồn tại
  let khachId = request.cookies.get('khach_id')?.value;
  let canSetKhachId = false;

  if (!khachId) {
    khachId = crypto.randomUUID();
    canSetKhachId = true;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  // Đính kèm cookie khach_id vào response nếu vừa được tạo mới (hạn 2 năm)
  if (canSetKhachId && khachId) {
    response.cookies.set('khach_id', khachId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 năm
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

### Task 4: Ghi nhận lượt xem tại trang đọc chương

**Files:**
- Modify: `app/truyen/[slug]/chuong/[so]/page.tsx`

**Interfaces:**
- Lấy cookie `khach_id` qua `cookies()` từ `next/headers`.
- Lấy thông tin user đăng nhập qua `supabase.auth.getUser()`.
- Xác định `visitorKey`: nếu user đã đăng nhập dùng `'nguoidung:' + user.id`, nếu chưa đăng nhập dùng `'khach:' + khachId` (nếu không có cả 2 thì fallback bỏ qua không gọi RPC).
- Gọi `supabase.rpc('ghi_luot_xem', { p_visitor_key: visitorKey, p_chuong_id: chuong.id, p_truyen_id: chuong.truyen_id })`.
- Bọc toàn bộ lời gọi trong block `try { ... } catch (err) { console.error('Lỗi khi ghi lượt xem:', err); }`.

- [ ] **Step 1: Cập nhật `app/truyen/[slug]/chuong/[so]/page.tsx`**

Chỉnh sửa file `app/truyen/[slug]/chuong/[so]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import LuuTienDo from './LuuTienDo';

export default async function TrangDocChuong({
  params,
}: {
  params: Promise<{ slug: string; so: string }>;
}) {
  const { slug, so } = await params;
  const soChuong = parseInt(so, 10);
  const supabase = await taoSupabaseServerClient();

  const { data: truyen } = await supabase
    .from('truyen')
    .select('id, ten')
    .eq('slug', slug)
    .maybeSingle();
  if (!truyen) notFound();

  const { data: chuong } = await supabase
    .from('chuong')
    .select('id, truyen_id, so_chuong, tieu_de, noi_dung')
    .eq('truyen_id', truyen.id)
    .eq('so_chuong', soChuong)
    .maybeSingle();
  if (!chuong) notFound();

  // Ghi nhận lượt xem (chống trùng vĩnh viễn, không chặn render nội dung)
  try {
    const cookieStore = await cookies();
    const khachId = cookieStore.get('khach_id')?.value;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const visitorKey = user
      ? `nguoidung:${user.id}`
      : khachId
      ? `khach:${khachId}`
      : null;

    if (visitorKey) {
      await supabase.rpc('ghi_luot_xem', {
        p_visitor_key: visitorKey,
        p_chuong_id: chuong.id,
        p_truyen_id: chuong.truyen_id,
      });
    }
  } catch (error) {
    console.error('Lỗi khi ghi lượt xem:', error);
  }

  const [{ data: chuongTruoc }, { data: chuongSau }] = await Promise.all([
    supabase
      .from('chuong')
      .select('so_chuong')
      .eq('truyen_id', truyen.id)
      .lt('so_chuong', soChuong)
      .order('so_chuong', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('chuong')
      .select('so_chuong')
      .eq('truyen_id', truyen.id)
      .gt('so_chuong', soChuong)
      .order('so_chuong', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <main className="w-full max-w-2xl mx-auto p-4">
      <LuuTienDo truyenId={truyen.id} chuongId={chuong.id} />
      <p className="text-sm text-gray-500">
        <Link href={`/truyen/${slug}`} className="hover:underline">
          {truyen.ten}
        </Link>
      </p>
      <h1 className="text-xl font-bold mt-1">
        Chương {chuong.so_chuong}: {chuong.tieu_de}
      </h1>
      <article className="mt-4 whitespace-pre-line leading-relaxed">{chuong.noi_dung}</article>
      <nav className="mt-6 flex justify-between">
        {chuongTruoc ? (
          <Link href={`/truyen/${slug}/chuong/${chuongTruoc.so_chuong}`} className="hover:underline">
            ← Chương trước
          </Link>
        ) : (
          <span />
        )}
        {chuongSau ? (
          <Link href={`/truyen/${slug}/chuong/${chuongSau.so_chuong}`} className="hover:underline">
            Chương sau →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
```

---

### Task 5: Hiển thị lượt xem trên thẻ truyện (`TheTruyen.tsx`) và cập nhật các trang danh sách

**Files:**
- Modify: `components/TheTruyen.tsx`
- Modify: `app/page.tsx`
- Modify: `app/the-loai/[slug]/page.tsx`

**Interfaces:**
- `TruyenThe`: thêm thuộc tính `luotXem?: number`.
- Hiển thị badge hoặc dòng meta kèm icon lượt xem (SVG eye) và `dinhDangSoRutGon(truyen.luotXem ?? 0)`.
- Các query truyện tại `app/page.tsx` và `app/the-loai/[slug]/page.tsx` bổ sung select cột `luot_xem`.

- [ ] **Step 1: Cập nhật `components/TheTruyen.tsx`**

Chỉnh sửa file `components/TheTruyen.tsx`:

```typescript
import Link from 'next/link';
import Image from 'next/image';
import { dinhDangSoRutGon } from '@/lib/utils/format';

export type TruyenThe = {
  slug: string;
  ten: string;
  tacGia: string | null;
  anhBia: string | null;
  trangThai: string;
  theLoai: { ten: string; slug: string }[];
  luotXem?: number;
};

export default function TheTruyen({ truyen }: { truyen: TruyenThe }) {
  const theLoaiHienThi = truyen.theLoai.slice(0, 3);
  const soDu = truyen.theLoai.length - theLoaiHienThi.length;

  return (
    <Link
      href={`/truyen/${truyen.slug}`}
      className="block rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[2/3] bg-gray-200">
        {truyen.anhBia ? (
          <Image
            src={truyen.anhBia}
            alt={truyen.ten}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm px-2 text-center">
            Chưa có ảnh bìa
          </div>
        )}
        <span className="absolute top-1 left-1 px-2 py-0.5 rounded text-xs bg-black/60 text-white">
          {truyen.trangThai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
        </span>
      </div>
      <div className="p-2">
        <h3 className="font-medium line-clamp-2">{truyen.ten}</h3>
        <div className="flex items-center justify-between text-sm text-gray-500 mt-1">
          {truyen.tacGia ? (
            <p className="truncate flex-1 pr-1">{truyen.tacGia}</p>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            {dinhDangSoRutGon(truyen.luotXem ?? 0)}
          </span>
        </div>
        {theLoaiHienThi.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {theLoaiHienThi.map((tl) => (
              <span
                key={tl.slug}
                className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
              >
                {tl.ten}
              </span>
            ))}
            {soDu > 0 && <span className="text-xs px-1.5 py-0.5 text-gray-500">+{soDu}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Cập nhật `app/page.tsx` (Trang chủ)**

Chỉnh sửa file `app/page.tsx`:

```typescript
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import SearchBox from '@/components/SearchBox';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';

type HangTruyen = {
  ten: string;
  slug: string;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  luot_xem: number;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await taoSupabaseServerClient();

  let query = supabase
    .from('truyen')
    .select('ten, slug, anh_bia, trang_thai, tac_gia, luot_xem, truyen_the_loai(the_loai(ten, slug))')
    .order('created_at', { ascending: false });
  if (q) {
    query = query.ilike('ten', `%${q}%`);
  }
  const { data } = await query;
  const dsTruyen = (data ?? []) as HangTruyen[];

  const dsThe: TruyenThe[] = dsTruyen.map((t) => ({
    slug: t.slug,
    ten: t.ten,
    tacGia: t.tac_gia,
    anhBia: t.anh_bia,
    trangThai: t.trang_thai,
    luotXem: t.luot_xem ?? 0,
    theLoai: t.truyen_the_loai.map((n) => n.the_loai),
  }));

  return (
    <main className="w-full max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Truyện dịch AI</h1>
      <SearchBox defaultValue={q ?? ''} />
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dsThe.map((truyen) => (
          <TheTruyen key={truyen.slug} truyen={truyen} />
        ))}
      </div>
      {dsThe.length === 0 && <p className="mt-4 text-gray-500">Không tìm thấy truyện nào.</p>}
    </main>
  );
}
```

- [ ] **Step 3: Cập nhật `app/the-loai/[slug]/page.tsx` (Trang thể loại)**

Chỉnh sửa file `app/the-loai/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import TheTruyen, { type TruyenThe } from '@/components/TheTruyen';

type HangLienKet = {
  truyen: {
    slug: string;
    ten: string;
    anh_bia: string | null;
    trang_thai: string;
    tac_gia: string | null;
    luot_xem: number;
  };
};

export default async function TrangTheLoai({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data: theLoai } = await supabase
    .from('the_loai')
    .select('id, ten, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!theLoai) notFound();

  const { data } = await supabase
    .from('truyen_the_loai')
    .select('truyen(slug, ten, anh_bia, trang_thai, tac_gia, luot_xem)')
    .eq('the_loai_id', theLoai.id);

  const dsLienKet = (data ?? []) as HangLienKet[];
  const dsThe: TruyenThe[] = dsLienKet.map((lk) => ({
    slug: lk.truyen.slug,
    ten: lk.truyen.ten,
    tacGia: lk.truyen.tac_gia,
    anhBia: lk.truyen.anh_bia,
    trangThai: lk.truyen.trang_thai,
    luotXem: lk.truyen.luot_xem ?? 0,
    theLoai: [],
  }));

  return (
    <main className="w-full max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Thể loại: {theLoai.ten}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {dsThe.map((truyen) => (
          <TheTruyen key={truyen.slug} truyen={truyen} />
        ))}
      </div>
      {dsThe.length === 0 && (
        <p className="text-gray-500">Chưa có truyện nào thuộc thể loại này.</p>
      )}
    </main>
  );
}
```

---

### Task 6: Hiển thị lượt xem tại trang chi tiết truyện

**Files:**
- Modify: `app/truyen/[slug]/page.tsx`

**Interfaces:**
- Select bổ sung `luot_xem` trong truy vấn `truyen`.
- Render dòng thông tin meta cạnh tác giả / trạng thái kèm biểu tượng con mắt và `dinhDangSoRutGon(truyen.luot_xem)`.

- [ ] **Step 1: Cập nhật `app/truyen/[slug]/page.tsx`**

Chỉnh sửa file `app/truyen/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { dinhDangSoRutGon } from '@/lib/utils/format';

type HangTruyen = {
  id: string;
  ten: string;
  mo_ta: string | null;
  anh_bia: string | null;
  trang_thai: string;
  tac_gia: string | null;
  luot_xem: number;
  truyen_the_loai: { the_loai: { ten: string; slug: string } }[];
};

export default async function TrangTruyen({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await taoSupabaseServerClient();

  const { data } = await supabase
    .from('truyen')
    .select(
      'id, ten, mo_ta, anh_bia, trang_thai, tac_gia, luot_xem, truyen_the_loai(the_loai(ten, slug))'
    )
    .eq('slug', slug)
    .maybeSingle();
  const truyen = data as HangTruyen | null;

  if (!truyen) notFound();

  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('id, so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let chuongDangDoc: { so_chuong: number } | null = null;
  if (user) {
    const { data: tienDo } = await supabase
      .from('tien_do_doc')
      .select('chuong:chuong_id(so_chuong)')
      .eq('user_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    chuongDangDoc = (tienDo?.chuong as { so_chuong: number } | null) ?? null;
  }

  return (
    <main className="w-full max-w-3xl mx-auto p-4">
      <div className="flex gap-4">
        <div className="relative w-32 aspect-[2/3] shrink-0 bg-gray-200 rounded overflow-hidden">
          {truyen.anh_bia ? (
            <Image
              src={truyen.anh_bia}
              alt={truyen.ten}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400 text-xs text-center px-1">
              Chưa có ảnh bìa
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{truyen.ten}</h1>
          {truyen.tac_gia && <p className="text-gray-600">Tác giả: {truyen.tac_gia}</p>}
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {dinhDangSoRutGon(truyen.luot_xem ?? 0)} lượt xem
            </span>
          </div>
          {truyen.truyen_the_loai.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {truyen.truyen_the_loai.map((n) => (
                <Link
                  key={n.the_loai.slug}
                  href={`/the-loai/${n.the_loai.slug}`}
                  className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {n.the_loai.ten}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {truyen.mo_ta && <p className="mt-4 text-gray-600 whitespace-pre-line">{truyen.mo_ta}</p>}
      {chuongDangDoc && (
        <Link
          href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
          className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 text-white"
        >
          Đọc tiếp Chương {chuongDangDoc.so_chuong}
        </Link>
      )}
      <ul className="mt-6 space-y-1">
        {(dsChuong ?? []).map((chuong) => (
          <li key={chuong.id}>
            <Link href={`/truyen/${slug}/chuong/${chuong.so_chuong}`} className="hover:underline">
              Chương {chuong.so_chuong}: {chuong.tieu_de}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

---

### Task 7: Kiểm chứng tích hợp thủ công (Manual Verification Checklist)

Thực hiện kiểm tra thủ công qua 5 kịch bản để đảm bảo tính năng hoạt động chính xác và ổn định:

- [x] **Kịch bản 1: Khách vãng lai đọc chương lần đầu** — đã verify thật qua browser + Supabase
      (truyện "Tà Tu Hảo A..."): đọc Chương 1 → `truyen.luot_xem` 0→1, `chuong.luot_xem` chương 1
      →1, `luot_xem_da_doc` có dòng `khach:<uuid>` đúng `chuong_id`.
  - Mở trình duyệt ẩn danh (Incognito), truy cập `http://localhost:3000/`.
  - Mở DevTools (F12) → Application → Cookies → kiểm tra có cookie `khach_id` được sinh ra tự động.
  - Bấm vào một bộ truyện bất kỳ (ví dụ: `truyen-a`) rồi bấm đọc `Chương 1`.
  - Mở Supabase Dashboard → Table Editor:
    - Bảng `luot_xem_da_doc`: xuất hiện 1 dòng mới với `visitor_key = 'khach:<uuid>'` và `chuong_id` tương ứng.
    - Bảng `chuong`: cột `luot_xem` của chương 1 tăng đúng 1.
    - Bảng `truyen`: cột `luot_xem` của `truyen-a` tăng đúng 1.

- [x] **Kịch bản 2: Đọc lại đúng chương đó (Chống trùng vĩnh viễn)** — đã verify: mở lại Chương 1
      nhiều lần, `luot_xem_da_doc` không có dòng mới, `chuong.luot_xem`/`truyen.luot_xem` giữ
      nguyên.

- [x] **Kịch bản 3: Đọc sang chương khác của cùng bộ truyện** — đã verify: đọc Chương 11 (chương kế
      tiếp thật sự có dữ liệu, do truyện thiếu chương 2-10) → `luot_xem_da_doc` thêm 1 dòng,
      `chuong.luot_xem` của chương 11 = 1, `truyen.luot_xem` cộng dồn thành 2.

- [ ] **Kịch bản 4: Người dùng đã đăng nhập tài khoản** — CHƯA test (Claude không tự đăng nhập tài
      khoản thật theo quy tắc an toàn của dự án, xem `docs/handoff/an-toan-thao-tac.md`). User tự
      đăng nhập rồi đọc 1 chương mới, kiểm tra `luot_xem_da_doc` ghi đúng `visitor_key =
      'nguoidung:<user_id>'`.

- [x] **Kịch bản 5: Hiển thị UI số lượt xem nhất quán trên toàn web** — đã verify trang chủ + trang
      truyện hiển thị đúng số ("2 lượt xem" cạnh icon mắt). Định dạng rút gọn K/M không test trực
      tiếp trên UI (bị chặn sửa dữ liệu thật để giả lập số lớn) nhưng đã có unit test đầy đủ cho
      đúng case `12500 → "12.5K"` trong `lib/utils/format.test.ts` (21/21 pass).

---

## Self-review

1. **Khớp 100% Spec `2026-09-10-dot-b-luot-xem-design.md`:** 
   - Đã loại bỏ hoàn toàn khái niệm "cửa sổ thời gian 30 phút" và bảng `luot_xem_log`.
   - Bảng dedup chuẩn tên `luot_xem_da_doc` với primary key kép `(visitor_key, chuong_id)` chống trùng vĩnh viễn trọn đời.
   - Function `ghi_luot_xem` cập nhật đồng thời cả `chuong.luot_xem` và `truyen.luot_xem` thông qua kiểm tra `IF FOUND` sau `ON CONFLICT DO NOTHING`.
   - Hàm `dinhDangSoRutGon` và test suite dùng chữ `K` HOA (`12.5K`) và `M` HOA (`3.4M`).
   - Cookie `khach_id` hạn 2 năm (`60 * 60 * 24 * 365 * 2`).
2. **Code thật, không placeholder:** Tất cả các khối code, câu lệnh SQL, file test và component đều được viết code hoàn chỉnh 100%, không sử dụng placeholder hoặc TODO dở dang.
3. **Tuân thủ quy tắc dự án:** Sử dụng tiếng Việt không dấu cho tên hàm/biến domain, tuân thủ kiến trúc Server Component Next.js App Router, RLS an toàn với `security definer`, và giữ nguyên vẹn các phần code hiện có.