# Tính năng "Đã lưu" (bookmark truyện) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho user đã đăng nhập lưu truyện muốn đọc sau (nút trên trang truyện) và xem lại danh
sách đã lưu trong tab "Đã lưu" của trang Tủ truyện (`/tu-truyen`).

**Architecture:** 1 bảng Postgres mới `truyen_da_luu` (RLS theo user) + 2 Server Actions
(`luuTruyen`/`boLuuTruyen`) theo đúng pattern `luuTienDoDoc` đã có trong repo + 1 nút client
component trên trang truyện + trang Tủ truyện chuyển từ placeholder tĩnh sang server component có
query thật + 1 component hàng danh sách.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres +
Auth + RLS), TypeScript, Tailwind CSS v4 (biến theme có sẵn trong `app/globals.css`).

## Global Constraints

- Tên bảng/cột/hàm/biến bằng tiếng Việt không dấu, theo đúng văn phong đã dùng trong repo (`truyen`,
  `nguoi_dung`, `luuTienDoDoc`, v.v.).
- Bảng nghiệp vụ mới PHẢI tham chiếu `nguoi_dung(id)`, KHÔNG tham chiếu `auth.users` trực tiếp
  (quyết định đã chốt, làm nền tảng cho tính năng nạp tiền/mua chương sau này).
- Không thêm thư viện icon mới — dùng SVG thô inline giống `TheTruyen.tsx`/`app/truyen/[slug]/page.tsx`
  đã làm với icon lượt xem.
- Không viết unit test mock Supabase cho Server Actions — codebase hiện tại không có pattern này
  (`luuTienDoDoc` cũng không có test riêng), verify qua build + test suite hiện có + kiểm chứng
  browser thật.
- Migration SQL do **user tự chạy** qua Supabase Dashboard (theo đúng quy trình mọi bảng trước đó
  trong dự án) — Claude/engineer KHÔNG tự kết nối DB để chạy DDL.
- Claude KHÔNG tự đăng nhập tài khoản Supabase Auth thật để test (quy tắc an toàn dự án) — kiểm
  chứng thật cần dùng phiên đã đăng nhập sẵn do user chuẩn bị trước, hoặc do user tự làm.

---

### Task 1: Migration SQL cho bảng `truyen_da_luu`

**Files:**
- Modify: `supabase/schema.sql` (append cuối file)

**Interfaces:**
- Produces: bảng `truyen_da_luu(nguoi_dung_id uuid, truyen_id uuid, luu_luc timestamptz)`, PK kép
  `(nguoi_dung_id, truyen_id)`, dùng bởi Task 2 (Server Actions) và Task 4 (trang Tủ truyện).

- [ ] **Step 1: Thêm SQL vào cuối `supabase/schema.sql`**

```sql

-- Tính năng "Đã lưu" (2026-09-13): bookmark truyện
create table if not exists truyen_da_luu (
  nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
  truyen_id uuid not null references truyen(id) on delete cascade,
  luu_luc timestamptz not null default now(),
  primary key (nguoi_dung_id, truyen_id)
);

alter table truyen_da_luu enable row level security;

drop policy if exists "user xem truyen da luu cua minh" on truyen_da_luu;
create policy "user xem truyen da luu cua minh" on truyen_da_luu
  for select using (auth.uid() = nguoi_dung_id);

drop policy if exists "user luu truyen cho minh" on truyen_da_luu;
create policy "user luu truyen cho minh" on truyen_da_luu
  for insert with check (auth.uid() = nguoi_dung_id);

drop policy if exists "user bo luu truyen cua minh" on truyen_da_luu;
create policy "user bo luu truyen cua minh" on truyen_da_luu
  for delete using (auth.uid() = nguoi_dung_id);
```

- [ ] **Step 2: Commit file schema**

```bash
git add supabase/schema.sql
git commit -m "feat: schema bang truyen_da_luu cho tinh nang Da luu truyen"
```

- [ ] **Step 3: Báo user tự chạy SQL này qua Supabase Dashboard → SQL Editor**

Dừng lại ở đây và nhắc user: "Đã thêm SQL bảng `truyen_da_luu` vào `supabase/schema.sql`. Bạn tự
chạy đoạn SQL mới (từ dòng `-- Tính năng "Đã lưu"`) qua Supabase Dashboard → SQL Editor trước khi
mình làm tiếp các task sau, vì Task 3-4 cần bảng này tồn tại để kiểm chứng thật." Chờ user xác nhận
đã chạy xong rồi mới sang Task 2 (Task 2 vẫn viết được code không cần DB, nhưng kiểm chứng cuối cần
bảng tồn tại).

---

### Task 2: Server Actions `luuTruyen` / `boLuuTruyen`

**Files:**
- Create: `app/truyen/[slug]/actions-luu.ts`

**Interfaces:**
- Consumes: `taoSupabaseServerClient()` từ `lib/supabase/server.ts` (đã có, không đổi).
- Produces:
  - `luuTruyen(truyenId: string): Promise<{ thanhCong: boolean; canDangNhap: boolean }>`
  - `boLuuTruyen(truyenId: string): Promise<{ thanhCong: boolean; canDangNhap: boolean }>`
  - Dùng bởi Task 3 (`NutLuuTruyen.tsx`) và Task 4 (`DongTruyenDaLuu.tsx`, chỉ dùng `boLuuTruyen`).

- [ ] **Step 1: Viết file action**

```ts
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
```

- [ ] **Step 2: Build để kiểm tra type-check sạch (chưa có UI dùng tới, chỉ kiểm tra file biên dịch được)**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript ở `app/truyen/[slug]/actions-luu.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/truyen/[slug]/actions-luu.ts
git commit -m "feat: server actions luuTruyen/boLuuTruyen cho tinh nang Da luu truyen"
```

---

### Task 3: Nút "Lưu truyện" trên trang truyện

**Files:**
- Create: `app/truyen/[slug]/NutLuuTruyen.tsx`
- Modify: `app/truyen/[slug]/page.tsx`

**Interfaces:**
- Consumes: `luuTruyen`, `boLuuTruyen` từ `app/truyen/[slug]/actions-luu.ts` (Task 2).
- Produces: component `NutLuuTruyen` props `{ truyenId: string; daLuuBanDau: boolean; daDangNhap: boolean }`.

- [ ] **Step 1: Viết `NutLuuTruyen.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { luuTruyen, boLuuTruyen } from './actions-luu';

export default function NutLuuTruyen({
  truyenId,
  daLuuBanDau,
  daDangNhap,
}: {
  truyenId: string;
  daLuuBanDau: boolean;
  daDangNhap: boolean;
}) {
  const [daLuu, setDaLuu] = useState(daLuuBanDau);
  const [hienThongBaoDangNhap, setHienThongBaoDangNhap] = useState(false);

  async function bamNut() {
    if (!daDangNhap) {
      setHienThongBaoDangNhap(true);
      return;
    }
    const trangThaiMoi = !daLuu;
    setDaLuu(trangThaiMoi);
    const ketQua = trangThaiMoi ? await luuTruyen(truyenId) : await boLuuTruyen(truyenId);
    if (!ketQua.thanhCong) {
      setDaLuu(!trangThaiMoi);
      if (ketQua.canDangNhap) setHienThongBaoDangNhap(true);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={bamNut}
        className={
          daLuu
            ? 'px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium'
            : 'px-4 py-2 rounded border border-border text-sm font-medium'
        }
      >
        {daLuu ? 'Đã lưu' : '+ Lưu truyện'}
      </button>
      {hienThongBaoDangNhap && (
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href="/dang-nhap" className="underline">
            Đăng nhập
          </Link>{' '}
          để lưu truyện.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sửa `app/truyen/[slug]/page.tsx` — thêm import + query trạng thái đã lưu**

Thêm import ở đầu file (dưới các import có sẵn, dòng 1-5):

```tsx
import NutLuuTruyen from './NutLuuTruyen';
```

Sửa khối lấy `user` (dòng 43-56 hiện tại) — giữ nguyên phần `tien_do_doc` sẵn có, thêm query mới
ngay sau đó:

```tsx
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
    chuongDangDoc = (tienDo?.chuong as unknown as { so_chuong: number } | null) ?? null;
  }

  let daLuuBanDau = false;
  if (user) {
    const { data: daLuu } = await supabase
      .from('truyen_da_luu')
      .select('truyen_id')
      .eq('nguoi_dung_id', user.id)
      .eq('truyen_id', truyen.id)
      .maybeSingle();
    daLuuBanDau = !!daLuu;
  }
```

- [ ] **Step 3: Gắn `<NutLuuTruyen />` vào JSX**

Trong khối JSX hiện tại, ngay sau đoạn hiển thị badge thể loại (đoạn kết thúc bằng `)}` trước dòng
`</div>` đóng cột phải — tức sau dòng có `{truyen.truyen_the_loai.length > 0 && (...)}`), thêm:

```tsx
          <NutLuuTruyen
            truyenId={truyen.id}
            daLuuBanDau={daLuuBanDau}
            daDangNhap={!!user}
          />
```

Vị trí chính xác: chèn ngay trước dòng `</div>` đóng thẻ `<div>` bọc phần thông tin bên phải (cột
tên/tác giả/lượt xem/thể loại), tức trước dòng đóng của khối bắt đầu bằng `<div>` ở dòng 76 gốc.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript/ESLint.

- [ ] **Step 5: Commit**

```bash
git add app/truyen/[slug]/NutLuuTruyen.tsx app/truyen/[slug]/page.tsx
git commit -m "feat: nut Luu truyen tren trang truyen"
```

---

### Task 4: Tab "Đã lưu" trong trang Tủ truyện

**Files:**
- Create: `app/tu-truyen/DongTruyenDaLuu.tsx`
- Modify: `app/tu-truyen/page.tsx` (thay toàn bộ nội dung placeholder hiện tại)

**Interfaces:**
- Consumes: `boLuuTruyen` từ `@/app/truyen/[slug]/actions-luu` (Task 2).
- Produces: trang `/tu-truyen` hiển thị danh sách đã lưu thật; component `DongTruyenDaLuu` props
  `{ truyenId: string; slug: string; ten: string; anhBia: string | null }`.

- [ ] **Step 1: Viết `DongTruyenDaLuu.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { boLuuTruyen } from '@/app/truyen/[slug]/actions-luu';

export default function DongTruyenDaLuu({
  truyenId,
  slug,
  ten,
  anhBia,
}: {
  truyenId: string;
  slug: string;
  ten: string;
  anhBia: string | null;
}) {
  const [daXoa, setDaXoa] = useState(false);

  async function boLuu() {
    setDaXoa(true);
    const ketQua = await boLuuTruyen(truyenId);
    if (!ketQua.thanhCong) setDaXoa(false);
  }

  if (daXoa) return null;

  return (
    <li className="flex items-center gap-3 border border-border bg-surface rounded-lg p-2">
      <div className="relative w-10 aspect-[2/3] shrink-0 bg-background rounded overflow-hidden">
        {anhBia && (
          <Image src={anhBia} alt={ten} fill sizes="40px" className="object-cover" />
        )}
      </div>
      <Link href={`/truyen/${slug}`} className="flex-1 truncate hover:underline">
        {ten}
      </Link>
      <button
        onClick={boLuu}
        className="text-sm text-muted-foreground hover:underline shrink-0"
      >
        Bỏ lưu
      </button>
    </li>
  );
}
```

- [ ] **Step 2: Viết lại `app/tu-truyen/page.tsx`**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DongTruyenDaLuu from './DongTruyenDaLuu';

type HangDaLuu = {
  truyen_id: string;
  truyen: { slug: string; ten: string; anh_bia: string | null };
};

export default async function TrangTuTruyen() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dsDaLuu: HangDaLuu[] = [];
  if (user) {
    const { data } = await supabase
      .from('truyen_da_luu')
      .select('truyen_id, truyen:truyen_id(slug, ten, anh_bia)')
      .eq('nguoi_dung_id', user.id)
      .order('luu_luc', { ascending: false });
    dsDaLuu = (data as unknown as HangDaLuu[]) ?? [];
  }

  return (
    <main className="w-full max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold">Tủ truyện</h1>
      <h2 className="mt-4 text-sm font-semibold uppercase text-muted-foreground">Đã lưu</h2>

      {!user ? (
        <p className="mt-3 text-muted-foreground">
          <Link href="/dang-nhap" className="underline">
            Đăng nhập
          </Link>{' '}
          để xem truyện đã lưu.
        </p>
      ) : dsDaLuu.length === 0 ? (
        <p className="mt-3 text-muted-foreground">Chưa lưu truyện nào.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dsDaLuu.map((dong) => (
            <DongTruyenDaLuu
              key={dong.truyen_id}
              truyenId={dong.truyen_id}
              slug={dong.truyen.slug}
              ten={dong.truyen.ten}
              anhBia={dong.truyen.anh_bia}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript/ESLint.

- [ ] **Step 4: Chạy toàn bộ test suite hiện có (đảm bảo không phá vỡ gì)**

Run: `npx vitest run`
Expected: tất cả test hiện có (cai-dat-doc, dich-loi-supabase, format, theme, smoke) đều PASS,
không có test nào bị fail do thay đổi này (không thêm test mới ở task này vì không đổi logic
`lib/utils/*`).

- [ ] **Step 5: Commit**

```bash
git add app/tu-truyen/DongTruyenDaLuu.tsx app/tu-truyen/page.tsx
git commit -m "feat: tab Da luu that trong trang Tu truyen"
```

---

### Task 5: Kiểm chứng thật qua browser

**Files:** không tạo/sửa file — chỉ thao tác trình duyệt + đọc dữ liệu Supabase Dashboard.

**Interfaces:** không có (task kiểm chứng).

- [ ] **Step 1: Kiểm chứng khi CHƯA đăng nhập**

Mở `/truyen/[slug]` bất kỳ ở tab trình duyệt mới (chưa đăng nhập): xác nhận nút "+ Lưu truyện"
hiển thị bình thường; bấm vào → hiện đúng dòng "Đăng nhập để lưu truyện" kèm link, nút KHÔNG đổi
sang "Đã lưu". Mở `/tu-truyen`: xác nhận hiện đúng thông báo "Đăng nhập để xem truyện đã lưu".

- [ ] **Step 2: Kiểm chứng khi ĐÃ đăng nhập (dùng phiên user tự đăng nhập sẵn, Claude không tự đăng nhập)**

Nhờ user tự đăng nhập trước (hoặc dùng tab trình duyệt đã có sẵn phiên đăng nhập thật). Trên trang
1 truyện: bấm "+ Lưu truyện" → nút đổi ngay thành "Đã lưu" (không cần reload). Vào `/tu-truyen` →
truyện vừa lưu xuất hiện đúng trong danh sách. Quay lại trang truyện đó, bấm "Đã lưu" lần nữa →
nút đổi lại "+ Lưu truyện". Vào `/tu-truyen` → truyện đã biến mất khỏi danh sách.

- [ ] **Step 3: Kiểm chứng thứ tự + nút Bỏ lưu ngay trong Tủ truyện**

Lưu 2-3 truyện khác nhau theo thứ tự A → B → C. Vào `/tu-truyen`, xác nhận thứ tự hiển thị đúng
C → B → A (mới lưu gần nhất lên đầu). Bấm "Bỏ lưu" ngay trên hàng B → hàng B biến mất ngay khỏi
danh sách, danh sách còn lại C → A đúng thứ tự. Quay lại trang truyện B, xác nhận nút đã về lại
"+ Lưu truyện" (đồng bộ đúng, không lệch trạng thái).

- [ ] **Step 4: Kiểm tra console sạch lỗi**

Mở DevTools Console trên cả 2 trang (`/truyen/[slug]` và `/tu-truyen`) ở tab trình duyệt mới hoàn
toàn (không tính nhiễu HMR) — xác nhận không có lỗi JS nào phát sinh trong toàn bộ luồng Step 1-3.

- [ ] **Step 5: Cập nhật `NEXT_SESSION.md` và `CLAUDE.md` ghi nhận đã xong**

Thêm mục mới vào `NEXT_SESSION.md` mô tả tính năng "Đã lưu" đã xong + kiểm chứng thật (theo đúng
văn phong các mục trước trong file), cập nhật dòng "Trạng thái hiện tại" trong `CLAUDE.md` nếu cần.
Cập nhật `PROJECT_MAP.md` thêm bảng `truyen_da_luu` vào mục Data model và các file mới vào cấu trúc
thư mục.

- [ ] **Step 6: Commit tài liệu**

```bash
git add NEXT_SESSION.md CLAUDE.md PROJECT_MAP.md
git commit -m "docs: cap nhat trang thai sau khi hoan thanh tinh nang Da luu truyen"
```
