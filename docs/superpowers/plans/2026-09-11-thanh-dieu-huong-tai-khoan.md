# Thanh điều hướng + Trang Tài khoản + Theme toàn site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng skill `delegate-antigravity-sk` để giao từng
> Task cho Antigravity qua MCP (`use_antigravity`, mode `plan` rồi `accept-edits`), Claude duyệt và
> tự kiểm tra kết quả thật (chạy lệnh, đọc file, mở browser) sau mỗi Task trước khi sang Task kế
> tiếp — KHÔNG dùng `subagent-driven-development`/`executing-plans` chuẩn của superpowers (dự án
> này ghi đè bằng `CLAUDE.md`). Steps dùng checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Thêm thanh điều hướng dạng icon nổi (Trang chủ/Tài khoản/Tủ truyện), trang Tài khoản đầy
đủ (hồ sơ + đổi giao diện toàn site), trang Tủ truyện tạm "Sắp ra mắt", và hoàn tất hệ thống theme
toàn site 3 chế độ Sáng/Giấy/Tối (dứt điểm Task 10 dark mode còn treo từ v1).

**Architecture:** Biến CSS (`--mau-nen`, `--mau-nen-phu`, `--mau-chu`, `--mau-chu-phu`,
`--mau-vien`) đổi theo `data-theme` trên `<html>`, map vào Tailwind qua `@theme inline` thành các
class `bg-background`/`bg-surface`/`text-foreground`/`text-muted-foreground`/`border-border`. Theme
lưu ở `localStorage` (khóa `themeToanSite`), áp dụng ngay lập tức không cần reload, chống nhấp nháy
(FOUC) bằng 1 script inline chạy trước hydrate. Thanh điều hướng là client component `fixed` bên
trái, dùng `usePathname()` để tô đậm mục đang mở. Trang Tài khoản là server component đọc
Supabase Auth giống `Header.tsx` hiện tại.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, TypeScript, Supabase Auth, Vitest.

## Global Constraints

- Định danh biến/hàm domain dùng tiếng Việt không dấu kiểu camelCase (`docTheme`, `ghiTheme`,
  `ThanhDieuHuong`, `dangHoatDong`...).
- Theme toàn site và cài đặt đọc trong trang chương (`lib/utils/cai-dat-doc.ts`) là 2 hệ thống độc
  lập hoàn toàn — **không đụng** `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx` và
  `PanelCaiDatDoc.tsx` trong plan này.
- Không thêm dependency mới (không dùng `next-themes` hay thư viện icon ngoài — icon dùng SVG
  inline).
- Chạy test bằng `npm run test` (hoặc `npx vitest run`). Build bằng `npm run build`.
- Next.js 16 App Router, Tailwind v4.
- "Cấp độ: Thành viên" chỉ là text tĩnh, không có logic phân cấp thật.

---

### Task 1: Module `lib/utils/theme.ts` (TDD)

**Files:**
- Create: `lib/utils/theme.test.ts`
- Create: `lib/utils/theme.ts`

**Interfaces:**
- `export type ThemeToanSite = 'sang' | 'giay' | 'toi'`
- `export const THEME_MAC_DINH: ThemeToanSite = 'sang'`
- `export function chuanHoaTheme(input: unknown): ThemeToanSite`
- `export function docTheme(): ThemeToanSite` (đọc `localStorage` khóa `themeToanSite`)
- `export function ghiTheme(theme: ThemeToanSite): void` (ghi `localStorage` khóa `themeToanSite`)

- [ ] **Step 1: Viết test suite**

Tạo file `lib/utils/theme.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { chuanHoaTheme, docTheme, ghiTheme, THEME_MAC_DINH } from './theme';

describe('chuanHoaTheme', () => {
  it('chấp nhận giá trị hợp lệ', () => {
    expect(chuanHoaTheme('sang')).toBe('sang');
    expect(chuanHoaTheme('giay')).toBe('giay');
    expect(chuanHoaTheme('toi')).toBe('toi');
  });

  it('trả về mặc định khi giá trị không hợp lệ', () => {
    expect(chuanHoaTheme('xyz')).toBe(THEME_MAC_DINH);
    expect(chuanHoaTheme(null)).toBe(THEME_MAC_DINH);
    expect(chuanHoaTheme(undefined)).toBe(THEME_MAC_DINH);
    expect(chuanHoaTheme(123)).toBe(THEME_MAC_DINH);
  });
});

describe('docTheme / ghiTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('trả về mặc định khi chưa lưu gì', () => {
    expect(docTheme()).toBe(THEME_MAC_DINH);
  });

  it('ghi rồi đọc lại đúng giá trị', () => {
    ghiTheme('toi');
    expect(docTheme()).toBe('toi');
    ghiTheme('giay');
    expect(docTheme()).toBe('giay');
  });

  it('đọc dữ liệu hỏng trả về mặc định', () => {
    localStorage.setItem('themeToanSite', 'gia-tri-la');
    expect(docTheme()).toBe(THEME_MAC_DINH);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL (Red)**

Chạy: `npm run test`
Kỳ vọng: lỗi vì chưa có file `lib/utils/theme.ts`.

- [ ] **Step 3: Cài đặt `lib/utils/theme.ts`**

```typescript
export type ThemeToanSite = 'sang' | 'giay' | 'toi';

export const THEME_MAC_DINH: ThemeToanSite = 'sang';

const KHOA_LUU_TRU = 'themeToanSite';

export function chuanHoaTheme(input: unknown): ThemeToanSite {
  return input === 'sang' || input === 'giay' || input === 'toi' ? input : THEME_MAC_DINH;
}

export function docTheme(): ThemeToanSite {
  try {
    const raw = localStorage.getItem(KHOA_LUU_TRU);
    return chuanHoaTheme(raw);
  } catch {
    return THEME_MAC_DINH;
  }
}

export function ghiTheme(theme: ThemeToanSite): void {
  try {
    localStorage.setItem(KHOA_LUU_TRU, theme);
  } catch {
    // localStorage không khả dụng - theme chỉ tồn tại trong phiên hiện tại
  }
}
```

- [ ] **Step 4: Chạy lại test để xác nhận PASS (Green)**

Chạy: `npm run test`
Kỳ vọng: toàn bộ test trong `lib/utils/theme.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/theme.ts lib/utils/theme.test.ts
git commit -m "feat: module theme toan site (luu/doc localStorage)"
```

---

### Task 2: Biến CSS 3 theme trong `app/globals.css`

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Token Tailwind mới: `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`,
  `border-border`.
- Chọn theme qua `data-theme` trên `<html>`: không set (mặc định Sáng), `data-theme="giay"`,
  `data-theme="toi"`.

- [ ] **Step 1: Thay toàn bộ nội dung `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --mau-nen: #ffffff;
  --mau-nen-phu: #f9fafb;
  --mau-chu: #171717;
  --mau-chu-phu: #6b7280;
  --mau-vien: #e5e7eb;
}

:root[data-theme='giay'] {
  --mau-nen: #f4ecd8;
  --mau-nen-phu: #ece0c6;
  --mau-chu: #5b4636;
  --mau-chu-phu: #8a7360;
  --mau-vien: #d9c9a8;
}

:root[data-theme='toi'] {
  --mau-nen: #1a1a1a;
  --mau-nen-phu: #262626;
  --mau-chu: #e5e5e5;
  --mau-chu-phu: #a3a3a3;
  --mau-vien: #3f3f3f;
}

@theme inline {
  --color-background: var(--mau-nen);
  --color-surface: var(--mau-nen-phu);
  --color-foreground: var(--mau-chu);
  --color-muted-foreground: var(--mau-chu-phu);
  --color-border: var(--mau-vien);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

Lưu ý: đã bỏ khối `@media (prefers-color-scheme: dark)` cũ — thay bằng `data-theme` tường minh do
người dùng chọn, không tự theo hệ điều hành nữa.

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: bien CSS 3 theme (sang/giay/toi) cho toan site"
```

---

### Task 3: Component `components/ChonTheme.tsx`

**Files:**
- Create: `components/ChonTheme.tsx`

**Interfaces:**
- Consumes: `docTheme`, `ghiTheme`, `type ThemeToanSite` từ `@/lib/utils/theme` (Task 1).
- Produces: default export `ChonTheme()` — client component, không nhận prop.

- [ ] **Step 1: Tạo file `components/ChonTheme.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { docTheme, ghiTheme, type ThemeToanSite } from '@/lib/utils/theme';

const TUY_CHON: { gia: ThemeToanSite; nhan: string }[] = [
  { gia: 'sang', nhan: 'Sáng' },
  { gia: 'giay', nhan: 'Giấy' },
  { gia: 'toi', nhan: 'Tối' },
];

export default function ChonTheme() {
  const [theme, setTheme] = useState<ThemeToanSite>('sang');

  useEffect(() => {
    setTheme(docTheme());
  }, []);

  function doiTheme(themeMoi: ThemeToanSite) {
    setTheme(themeMoi);
    ghiTheme(themeMoi);
    document.documentElement.dataset.theme = themeMoi;
  }

  return (
    <div className="flex gap-2">
      {TUY_CHON.map((tc) => (
        <button
          key={tc.gia}
          type="button"
          onClick={() => doiTheme(tc.gia)}
          className={`flex-1 border rounded p-2 text-sm ${
            theme === tc.gia ? 'border-blue-500' : 'border-border'
          }`}
        >
          {tc.nhan}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChonTheme.tsx
git commit -m "feat: component doi theme toan site"
```

---

### Task 4: Component `components/ThanhDieuHuong.tsx`

**Files:**
- Create: `components/ThanhDieuHuong.tsx`

**Interfaces:**
- Default export `ThanhDieuHuong()` — client component, không nhận prop, tự dùng `usePathname()`.

- [ ] **Step 1: Tạo file `components/ThanhDieuHuong.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MUC: { duongDan: string; nhan: string; icon: ReactNode }[] = [
  {
    duongDan: '/',
    nhan: 'Trang chủ',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    duongDan: '/tai-khoan',
    nhan: 'Tài khoản',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    duongDan: '/tu-truyen',
    nhan: 'Tủ truyện',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
];

export default function ThanhDieuHuong() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 p-2 rounded-full border border-border bg-surface shadow-md">
      {MUC.map((muc) => {
        const dangHoatDong = pathname === muc.duongDan;
        return (
          <div key={muc.duongDan} className="group relative">
            <Link
              href={muc.duongDan}
              aria-label={muc.nhan}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                dangHoatDong
                  ? 'bg-foreground text-background'
                  : 'text-foreground hover:bg-background'
              }`}
            >
              {muc.icon}
            </Link>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {muc.nhan}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ThanhDieuHuong.tsx
git commit -m "feat: thanh dieu huong icon noi (Trang chu/Tai khoan/Tu truyen)"
```

---

### Task 5: Gắn theme + thanh điều hướng vào `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `ThanhDieuHuong` từ `@/components/ThanhDieuHuong` (Task 4).
- Script inline đọc `localStorage.getItem('themeToanSite')` và set
  `document.documentElement.dataset.theme` TRƯỚC khi React hydrate (chống FOUC).

- [ ] **Step 1: Thay toàn bộ nội dung `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import ThanhDieuHuong from "@/components/ThanhDieuHuong";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

const SCRIPT_CHONG_FOUC = `
try {
  var t = localStorage.getItem('themeToanSite');
  if (t === 'giay' || t === 'toi') {
    document.documentElement.dataset.theme = t;
  }
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="chong-fouc-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SCRIPT_CHONG_FOUC }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThanhDieuHuong />
        <Header />
        {children}
      </body>
    </html>
  );
}
```

Lưu ý: `suppressHydrationWarning` trên `<html>` và `<body>` là bắt buộc — script chống FOUC set
`data-theme` trước khi React hydrate, khiến thuộc tính này khác với HTML server render ra (server
không biết `localStorage` của client), React sẽ cảnh báo hydration mismatch nếu không có
`suppressHydrationWarning` (giống lỗi hydration đã gặp trước đó với `className` font, nhưng đây là
trường hợp CHỦ ĐỘNG chấp nhận khác biệt nên phải khai báo rõ để React bỏ qua).

- [ ] **Step 2: Chạy build để xác nhận không lỗi**

Chạy: `npm run build`
Kỳ vọng: build thành công, không lỗi TypeScript.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: gan script chong FOUC + thanh dieu huong vao layout goc"
```

---

### Task 6: Cập nhật `components/Header.tsx` (bỏ đăng nhập/đăng xuất, theme token)

**Files:**
- Modify: `components/Header.tsx`
- Modify: `components/DropdownTheLoai.tsx`

**Interfaces:**
- `Header` không còn truy vấn `user`/`nguoi_dung`, chỉ còn truy vấn `the_loai` cho
  `DropdownTheLoai`.

- [ ] **Step 1: Thay toàn bộ nội dung `components/Header.tsx`**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DropdownTheLoai from './DropdownTheLoai';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();

  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="w-full max-w-3xl mx-auto p-4 flex justify-between items-center">
      <Link href="/" className="font-bold">
        Truyện dịch AI
      </Link>
      <nav>
        <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Thay toàn bộ nội dung `components/DropdownTheLoai.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DropdownTheLoai({
  dsTheLoai,
}: {
  dsTheLoai: { ten: string; slug: string }[];
}) {
  const [moRong, setMoRong] = useState(false);

  if (dsTheLoai.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setMoRong(true)}
      onMouseLeave={() => setMoRong(false)}
    >
      <button type="button" className="hover:underline">
        Thể loại
      </button>
      {moRong && (
        <ul className="absolute left-0 top-full w-48 rounded border border-border bg-surface shadow-md z-10 max-h-64 overflow-y-auto">
          {dsTheLoai.map((tl) => (
            <li key={tl.slug}>
              <Link
                href={`/the-loai/${tl.slug}`}
                className="block px-3 py-2 hover:bg-background"
                onClick={() => setMoRong(false)}
              >
                {tl.ten}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Chạy build để xác nhận không còn import `NutDangXuat` thừa gây lỗi**

Chạy: `npm run build`
Kỳ vọng: build thành công. (File `components/NutDangXuat.tsx` vẫn giữ nguyên, không xoá — Task 7
sẽ dùng lại trong trang Tài khoản.)

- [ ] **Step 4: Commit**

```bash
git add components/Header.tsx components/DropdownTheLoai.tsx
git commit -m "refactor: bo dang nhap/dang xuat khoi Header, chuyen ve trang Tai khoan"
```

---

### Task 7: Trang Tài khoản — `app/tai-khoan/page.tsx`

**Files:**
- Create: `app/tai-khoan/page.tsx`

**Interfaces:**
- Consumes: `taoSupabaseServerClient` từ `@/lib/supabase/server`, `NutDangXuat` từ
  `@/components/NutDangXuat` (đã có sẵn), `ChonTheme` từ `@/components/ChonTheme` (Task 3).

- [ ] **Step 1: Tạo file `app/tai-khoan/page.tsx`**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import NutDangXuat from '@/components/NutDangXuat';
import ChonTheme from '@/components/ChonTheme';

export default async function TrangTaiKhoan() {
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

  return (
    <main className="w-full max-w-md mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Tài khoản</h1>

      <section className="border border-border bg-surface rounded-lg p-4">
        {user ? (
          <div className="space-y-3">
            <div>
              <p className="font-semibold">{tenNguoiDung ?? 'Người dùng'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">Cấp độ: Thành viên</p>
            <NutDangXuat />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground">Bạn chưa đăng nhập.</p>
            <div className="flex gap-3">
              <Link
                href="/dang-nhap"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="px-4 py-2 rounded border border-border text-sm font-medium"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="border border-border bg-surface rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">Giao diện</h2>
        <ChonTheme />
      </section>

      <section className="border border-border bg-surface rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-1">Cài đặt</h2>
        <p className="text-sm text-muted-foreground">Sắp ra mắt</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tai-khoan/page.tsx
git commit -m "feat: trang Tai khoan (ho so, doi theme, dang xuat)"
```

---

### Task 8: Trang Tủ truyện tạm — `app/tu-truyen/page.tsx`

**Files:**
- Create: `app/tu-truyen/page.tsx`

- [ ] **Step 1: Tạo file `app/tu-truyen/page.tsx`**

```tsx
export default function TrangTuTruyen() {
  return (
    <main className="w-full max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold">Tủ truyện</h1>
      <p className="mt-2 text-muted-foreground">Sắp ra mắt, đang phát triển.</p>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tu-truyen/page.tsx
git commit -m "feat: trang Tu truyen tam (sap ra mat)"
```

---

### Task 9: Theme token cho trang chủ, trang thể loại, trang truyện, thẻ truyện

**Files:**
- Modify: `components/TheTruyen.tsx`
- Modify: `app/page.tsx`
- Modify: `app/the-loai/[slug]/page.tsx`
- Modify: `app/truyen/[slug]/page.tsx`

- [ ] **Step 1: Cập nhật `components/TheTruyen.tsx`**

Thay các class màu cứng: `bg-gray-200` → `bg-surface`, `text-gray-400` → `text-muted-foreground`,
`text-gray-500` → `text-muted-foreground` (2 chỗ: dòng tác giả/lượt xem, và `+soDu`). Nội dung đầy
đủ sau khi sửa:

```tsx
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
      className="block rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[2/3] bg-surface">
        {truyen.anhBia ? (
          <Image
            src={truyen.anhBia}
            alt={truyen.ten}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm px-2 text-center">
            Chưa có ảnh bìa
          </div>
        )}
        <span className="absolute top-1 left-1 px-2 py-0.5 rounded text-xs bg-black/60 text-white">
          {truyen.trangThai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}
        </span>
      </div>
      <div className="p-2">
        <h3 className="font-medium line-clamp-2">{truyen.ten}</h3>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
          {truyen.tacGia ? (
            <p className="truncate flex-1 pr-1">{truyen.tacGia}</p>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
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
            {soDu > 0 && <span className="text-xs px-1.5 py-0.5 text-muted-foreground">+{soDu}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Cập nhật `app/page.tsx`**

Chỉ đổi dòng thông báo rỗng `text-gray-500` → `text-muted-foreground`, giữ nguyên toàn bộ phần
còn lại:

```tsx
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
  const dsTruyen = (data ?? []) as unknown as HangTruyen[];

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
      {dsThe.length === 0 && <p className="mt-4 text-muted-foreground">Không tìm thấy truyện nào.</p>}
    </main>
  );
}
```

- [ ] **Step 3: Cập nhật `app/the-loai/[slug]/page.tsx`**

Chỉ đổi dòng thông báo rỗng `text-gray-500` → `text-muted-foreground`:

```tsx
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

  const dsLienKet = (data ?? []) as unknown as HangLienKet[];
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
        <p className="text-muted-foreground">Chưa có truyện nào thuộc thể loại này.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Cập nhật `app/truyen/[slug]/page.tsx`**

Thay `bg-gray-200` → `bg-surface`, `text-gray-400` (2 chỗ) → `text-muted-foreground`,
`text-gray-600` (2 chỗ: tác giả, mô tả) → `text-muted-foreground`, `text-gray-500` (dòng
trạng thái/lượt xem) → `text-muted-foreground`:

```tsx
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
  const truyen = data as unknown as HangTruyen | null;

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
    chuongDangDoc = (tienDo?.chuong as unknown as { so_chuong: number } | null) ?? null;
  }

  return (
    <main className="w-full max-w-3xl mx-auto p-4">
      <div className="flex gap-4">
        <div className="relative w-32 aspect-[2/3] shrink-0 bg-surface rounded overflow-hidden">
          {truyen.anh_bia ? (
            <Image
              src={truyen.anh_bia}
              alt={truyen.ten}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-xs text-center px-1">
              Chưa có ảnh bìa
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{truyen.ten}</h1>
          {truyen.tac_gia && <p className="text-muted-foreground">Tác giả: {truyen.tac_gia}</p>}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{truyen.trang_thai === 'hoan-thanh' ? 'Hoàn thành' : 'Đang ra'}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-muted-foreground"
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
      {truyen.mo_ta && <p className="mt-4 text-muted-foreground whitespace-pre-line">{truyen.mo_ta}</p>}
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

- [ ] **Step 5: Chạy build**

Chạy: `npm run build`
Kỳ vọng: thành công, không lỗi TypeScript.

- [ ] **Step 6: Commit**

```bash
git add components/TheTruyen.tsx app/page.tsx app/the-loai/[slug]/page.tsx app/truyen/[slug]/page.tsx
git commit -m "style: doi mau cung sang theme token cho trang chu/the loai/trang truyen"
```

---

### Task 10: Theme token cho trang đăng ký / đăng nhập

**Files:**
- Modify: `app/dang-ky/page.tsx`
- Modify: `app/dang-nhap/page.tsx`

Cả 2 file đổi cùng pattern: `bg-white` → `bg-surface`, `border-gray-200`/`border-gray-300` →
`border-border`, `text-gray-900` → bỏ hẳn (kế thừa `text-foreground` từ `body`), `text-gray-700` →
`text-muted-foreground`, `text-gray-600`/`text-gray-500` → `text-muted-foreground`. Giữ nguyên
`bg-blue-600`, `bg-red-50`/`text-red-700`/`border-red-200`, `text-green-700` (màu trạng thái/nút
hành động, không phải nền/chữ trung tính nên không đổi).

- [ ] **Step 1: Cập nhật `app/dang-ky/page.tsx`**

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
      <main className="w-full max-w-md mx-auto p-6 bg-surface border border-border rounded-lg shadow-sm mt-8">
        <h1 className="text-2xl font-bold mb-4 text-green-700">Đăng ký thành công!</h1>
        <p className="text-muted-foreground leading-relaxed mb-6">
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
    <main className="w-full max-w-md mx-auto p-6 bg-surface border border-border rounded-lg shadow-sm mt-8">
      <h1 className="text-2xl font-bold mb-6">Đăng ký tài khoản</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Tên người dùng
          </label>
          <input
            type="text"
            required
            value={tenNguoiDung}
            onChange={(e) => setTenNguoiDung(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn A"
            className="border border-border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="border border-border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Mật khẩu (tối thiểu 6 ký tự)
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            placeholder="••••••••"
            className="border border-border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Xác nhận mật khẩu
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={xacNhanMatKhau}
            onChange={(e) => setXacNhanMatKhau(e.target.value)}
            placeholder="••••••••"
            className="border border-border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-surface text-muted-foreground">Hoặc tiếp tục với</span>
        </div>
      </div>

      <button
        type="button"
        onClick={dangNhapGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-border rounded-md hover:bg-background font-medium transition shadow-sm"
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link href="/dang-nhap" className="text-blue-600 hover:underline font-medium">
          Đăng nhập ngay
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Cập nhật `app/dang-nhap/page.tsx`**

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
    <main className="w-full max-w-md mx-auto p-6 bg-surface border border-border rounded-lg shadow-sm mt-8">
      <h1 className="text-2xl font-bold mb-6">Đăng nhập</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="border border-border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Mật khẩu
          </label>
          <input
            type="password"
            required
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            placeholder="••••••••"
            className="border border-border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-surface text-muted-foreground">Hoặc tiếp tục với</span>
        </div>
      </div>

      <button
        type="button"
        onClick={dangNhapGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-border rounded-md hover:bg-background font-medium transition shadow-sm"
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
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

- [ ] **Step 3: Chạy build + test toàn bộ**

Chạy: `npm run build` rồi `npm run test`
Kỳ vọng: cả 2 lệnh thành công.

- [ ] **Step 4: Commit**

```bash
git add app/dang-ky/page.tsx app/dang-nhap/page.tsx
git commit -m "style: doi mau cung sang theme token cho trang dang ky/dang nhap"
```

---

### Task 11: Kiểm chứng thủ công qua browser (Manual Verification Checklist)

Không viết test tự động cho phần UI thuần hiển thị (theo pattern dự án đã áp dụng cho các tính
năng UI trước) — kiểm chứng bằng browser thật:

- [ ] **Kịch bản 1 — Thanh điều hướng hiển thị đúng**: mở trang chủ, thấy thanh icon nổi bên trái
      với 3 icon (Trang chủ/Tài khoản/Tủ truyện). Hover từng icon thấy tooltip đúng tên. Icon
      "Trang chủ" đang tô đậm vì đang ở `/`.

- [ ] **Kịch bản 2 — Điều hướng hoạt động**: bấm icon "Tài khoản" → chuyển tới `/tai-khoan`, icon
      "Tài khoản" giờ tô đậm thay vì "Trang chủ". Bấm icon "Tủ truyện" → chuyển tới `/tu-truyen`,
      thấy chữ "Sắp ra mắt, đang phát triển".

- [ ] **Kịch bản 3 — Trang Tài khoản khi chưa đăng nhập**: mở `/tai-khoan` lúc chưa đăng nhập, thấy
      "Bạn chưa đăng nhập" + nút Đăng nhập/Đăng ký hoạt động đúng (điều hướng tới `/dang-nhap`,
      `/dang-ky`).

- [ ] **Kịch bản 4 — Đổi theme áp dụng ngay lập tức**: tại `/tai-khoan`, bấm lần lượt "Giấy" rồi
      "Tối" — quan sát toàn bộ trang (nền, chữ, thanh điều hướng, khung Tài khoản) đổi màu ngay,
      không cần reload. Điều hướng sang trang chủ, trang truyện, trang thể loại — theme vẫn được
      áp dụng nhất quán ở các trang đó.

- [ ] **Kịch bản 5 — Theme giữ nguyên sau reload, không FOUC**: đang ở theme "Tối", nhấn F5 reload
      trang — trang phải hiện màu tối ngay từ đầu, không có khoảnh khắc nhấp nháy trắng rồi mới
      chuyển tối.

- [ ] **Kịch bản 6 — Theme độc lập với cài đặt đọc chương**: đặt theme toàn site là "Tối", mở 1
      trang đọc chương — nền trang đọc chương vẫn theo cài đặt đọc riêng (mặc định "Sáng" trừ khi
      đã đổi trong `PanelCaiDatDoc`), không bị theme toàn site chi phối. Đổi màu nền trong
      `PanelCaiDatDoc` (ví dụ "Vàng") không ảnh hưởng theme toàn site (thanh điều hướng, Header vẫn
      giữ theme đã chọn).

- [ ] **Kịch bản 7 — Header không còn đăng nhập/đăng xuất**: kiểm tra Header ở mọi trang chỉ còn
      logo + dropdown "Thể loại", không còn "Xin chào {tên}"/Đăng xuất hoặc Đăng nhập/Đăng ký.

- [ ] **Kịch bản 8 — Đăng xuất từ trang Tài khoản** (chỉ xác nhận luồng, không tự bấm submit thật
      theo quy tắc an toàn dự án — nếu Claude thực hiện, chỉ quan sát nút hiển thị đúng, để user tự
      bấm thật nếu cần verify đăng xuất).

- [ ] **Kịch bản 9 — Console sạch**: không có lỗi JS nào trong console ở toàn bộ các trang đã test.

- [ ] **Kịch bản 10 — Build & test tự động**: `npm run build` và `npx vitest run` đều pass.

---

## Self-review

1. **Khớp spec `2026-09-11-thanh-dieu-huong-tai-khoan-design.md`:** Đủ 3 nút điều hướng dạng icon,
   trang Tài khoản đầy đủ (hồ sơ/cấp độ tĩnh/đổi theme/cài đặt placeholder), trang Tủ truyện tạm,
   Header bỏ đăng nhập/đăng xuất, theme độc lập với cài đặt đọc chương, áp dụng toàn site, dùng
   `localStorage` không thêm dependency.
2. **Không có placeholder trong code**: toàn bộ block code là nội dung đầy đủ, không có TODO/TBD.
3. **Nhất quán kiểu/tên hàm**: `ThemeToanSite`, `docTheme`, `ghiTheme`, `chuanHoaTheme` dùng thống
   nhất xuyên suốt Task 1, 3, 5, 7. Token CSS (`bg-background`, `bg-surface`, `text-foreground`,
   `text-muted-foreground`, `border-border`) dùng nhất quán ở mọi file từ Task 2 trở đi.
4. **Không đụng** `cai-dat-doc.ts`, `KhungDocChuong.tsx`, `PanelCaiDatDoc.tsx` — đúng như constraint
   đã chốt trong spec.
