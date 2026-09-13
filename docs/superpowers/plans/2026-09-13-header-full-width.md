# Header Full-Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header full-width theo bố cục truyendich.ai (logo + Thể loại bên trái, ô tìm kiếm bên
phải, trải hết chiều rộng màn hình) + đổi tên hiển thị site thành "Truyện chữ dịch".

**Architecture:** Chỉnh CSS/bố cục của `Header.tsx` (server component có sẵn), di chuyển
`SearchBox.tsx` (client component có sẵn, không đổi logic) từ trang chủ vào Header, dọn phần lặp ở
trang chủ, đổi metadata title.

**Tech Stack:** Next.js App Router, Tailwind CSS v4.

## Global Constraints

- Không thêm thư viện icon mới — icon sách trong logo dùng SVG thô inline.
- Không đổi logic `SearchBox.tsx` (submit/điều hướng), chỉ đổi class CSS.
- Không đụng `components/ThanhDieuHuong.tsx`.
- Không thêm mục "Danh sách" hay các section nội dung khác của trang mẫu truyendich.ai — chỉ
  Header.

---

### Task 1: Chuyển `SearchBox` vào `Header`, redesign full-width

**Files:**
- Modify: `components/Header.tsx`
- Modify: `components/SearchBox.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- `SearchBox` giữ nguyên props `{ defaultValue: string }` — chỉ đổi class CSS bên trong.
- Không có interface mới giữa các file (thuần chỉnh JSX/CSS + xoá code không dùng).

- [ ] **Step 1: Sửa `components/SearchBox.tsx` — chỉnh class cho gọn trong header**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBox({ defaultValue }: { defaultValue: string }) {
  const [gia, setGia] = useState(defaultValue);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (gia.trim()) params.set('q', gia.trim());
    router.push(`/?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2 flex-1">
      <input
        type="text"
        value={gia}
        onChange={(e) => setGia(e.target.value)}
        placeholder="Tìm truyện theo tên..."
        className="border border-border rounded-full px-3 py-1.5 text-sm flex-1 bg-background"
      />
      <button
        type="submit"
        className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
      >
        Tìm
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Viết lại `components/Header.tsx` — full-width, gộp logo + Thể loại + tìm kiếm**

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import DropdownTheLoai from './DropdownTheLoai';
import SearchBox from './SearchBox';

export default async function Header() {
  const supabase = await taoSupabaseServerClient();

  const { data: dsTheLoai } = await supabase
    .from('the_loai')
    .select('ten, slug')
    .order('ten', { ascending: true });

  return (
    <header className="w-full border-b border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-lg">
            <svg
              className="w-5 h-5 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2V5zM20 5a2 2 0 00-2-2h-5v18h5a2 2 0 002-2V5z"
              />
            </svg>
            Truyện chữ dịch
          </Link>
          <nav>
            <DropdownTheLoai dsTheLoai={dsTheLoai ?? []} />
          </nav>
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <SearchBox defaultValue="" />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Sửa `app/page.tsx` — bỏ tiêu đề lặp + `SearchBox` (đã chuyển lên Header)**

Xoá dòng import `SearchBox` và 2 dòng JSX sau trong hàm `TrangChu`:

```tsx
      <h1 className="text-2xl font-bold mb-4">Truyện dịch AI</h1>
      <SearchBox defaultValue={q ?? ''} />
```

File sau khi sửa còn lại phần khai báo `main` bắt đầu thẳng bằng `<div className="mt-4 grid ...">`
(bỏ `mt-4` nếu muốn, giữ nguyên cũng không sao vì không còn phần tử phía trên để so lệch margin).

- [ ] **Step 4: Sửa `app/layout.tsx` — đổi `metadata.title`**

Tìm dòng:
```tsx
  title: "Create Next App",
```
Đổi thành:
```tsx
  title: "Truyện chữ dịch",
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript/ESLint (chú ý: `app/page.tsx` không còn dùng
biến `q` cho `SearchBox` nhưng vẫn cần cho query Supabase — không xoá phần `searchParams`).

- [ ] **Step 6: Chạy test suite hiện có**

Run: `npx vitest run`
Expected: toàn bộ test hiện có PASS (không có test nào cho `Header`/`SearchBox`/`page.tsx`, đổi
thuần UI không ảnh hưởng logic đã test).

- [ ] **Step 7: Commit**

```bash
git add components/Header.tsx components/SearchBox.tsx app/page.tsx app/layout.tsx
git commit -m "feat: header full-width theo mau truyendich.ai, doi ten site thanh Truyen chu dich"
```

---

### Task 2: Kiểm chứng thật qua browser

**Files:** không tạo/sửa file.

- [ ] **Step 1**: Mở lần lượt `/`, `/truyen/[slug]` bất kỳ, `/tu-truyen`, `/tai-khoan`,
      `/the-loai/[slug]` — xác nhận Header full-width, hiện đúng "Truyện chữ dịch" + icon, dropdown
      Thể loại hoạt động, ô tìm kiếm hiện đúng vị trí bên phải.
- [ ] **Step 2**: Gõ tên 1 truyện vào ô tìm kiếm trên Header (thử từ 1 trang bất kỳ không phải
      trang chủ), bấm Tìm — xác nhận điều hướng về `/` với đúng kết quả lọc.
- [ ] **Step 3**: Tiêu đề tab trình duyệt hiện "Truyện chữ dịch". Trang chủ không còn dòng tiêu đề
      lặp phía trên lưới truyện.
- [ ] **Step 4**: Thu nhỏ cửa sổ trình duyệt xuống khổ mobile (hoặc dùng `resize_window` preset
      mobile) — xác nhận Header không vỡ layout, ô tìm kiếm tự xuống hàng nếu cần.
- [ ] **Step 5**: Console sạch lỗi trên toàn bộ các trang đã kiểm chứng.
- [ ] **Step 6**: Cập nhật `NEXT_SESSION.md`/`PROJECT_MAP.md` ghi nhận đã xong, commit tài liệu.
