# Redesign giao diện mobile-first (điều hướng, đọc chương, trang truyện) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng skill `delegate-antigravity-sk` để giao từng
> Task cho Antigravity qua MCP (`use_antigravity`, mode `plan` rồi `accept-edits`), Claude duyệt và
> tự kiểm tra kết quả thật (đọc file, build, mở browser resize mobile) sau mỗi Task trước khi sang
> Task kế tiếp — KHÔNG dùng `subagent-driven-development`/`executing-plans` chuẩn của superpowers
> (dự án này ghi đè bằng `CLAUDE.md`). Steps dùng checkbox (`- [ ]`) để theo dõi tiến độ.

**Goal:** Bố cục lại giao diện ưu tiên mobile: thanh điều hướng xuống đáy trên mobile, ẩn hẳn
Header/thanh điều hướng ở trang đọc chương (thay bằng thanh tối giản), sửa bug vị trí nút "Aa",
thêm nút Bắt đầu đọc + khối Giới thiệu truyện thu gọn ở trang truyện, thêm nút Danh sách chương +
làm nổi bật nút điều hướng chương ở trang đọc.

**Architecture:** Tạo 1 client wrapper `ChromeToanSite.tsx` dùng `usePathname()` để quyết định ẩn
Header/ThanhDieuHuong gốc theo route (nhận chúng qua props dạng `ReactNode`, giữ Header là async
Server Component không đổi). `ThanhDieuHuong.tsx` thêm biến thể responsive Tailwind (`md:` mobile
vs desktop). Trang đọc chương có thanh top riêng tối giản (icon nhà + Aa + Danh sách chương) dùng
`fixed` để không đè chữ khi cuộn. Trang truyện thêm component `MoTaTruyen.tsx` (client, line-clamp
+ toggle) và nút Bắt đầu đọc cạnh nút Đọc tiếp đã có sẵn.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, TypeScript, Supabase, Vitest.

## Global Constraints

- Định danh biến/hàm domain dùng tiếng Việt không dấu kiểu camelCase (`chuongDangDoc`,
  `dsChuong`, `MoTaTruyen`, `ChromeToanSite`...).
- Không thêm dependency mới (không icon library ngoài — SVG inline theo pattern có sẵn trong
  `ThanhDieuHuong.tsx`/`Header.tsx`).
- Không đụng `lib/utils/cai-dat-doc.ts`, `lib/utils/theme.ts` (2 hệ thống độc lập, không đổi hành
  vi lưu trữ hiện có).
- Không đổi schema Supabase — mọi dữ liệu cần (`dsChuong`, `tien_do_doc`) đã có sẵn cách query.
- Chạy test: `npm run test` (hoặc `npx vitest run`). Build: `npm run build`.
- Kiểm chứng UI bắt buộc qua Browser pane resize về 375px và 320px (không chỉ desktop).

---

### Task 1: `ChromeToanSite.tsx` — ẩn Header/ThanhDieuHuong theo route

**Files:**
- Create: `components/ChromeToanSite.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- `export default function ChromeToanSite({ header, dieuHuong, children }: { header: ReactNode;
  dieuHuong: ReactNode; children: ReactNode }): JSX.Element`
- Route bị ẩn: khớp pattern `/truyen/[slug]/chuong/[so]` — dùng regex
  `/^\/truyen\/[^/]+\/chuong\/[^/]+$/` trên `usePathname()`.

- [ ] **Step 1: Tạo `components/ChromeToanSite.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const MAU_TRANG_DOC_CHUONG = /^\/truyen\/[^/]+\/chuong\/[^/]+$/;

export default function ChromeToanSite({
  header,
  dieuHuong,
  children,
}: {
  header: ReactNode;
  dieuHuong: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const laTrangDocChuong = MAU_TRANG_DOC_CHUONG.test(pathname ?? '');

  if (laTrangDocChuong) {
    return <>{children}</>;
  }

  return (
    <>
      {dieuHuong}
      {header}
      {children}
    </>
  );
}
```

- [ ] **Step 2: Sửa `app/layout.tsx` dùng wrapper**

Thay đoạn:
```tsx
        <ThanhDieuHuong />
        <Header />
        {children}
        <Analytics />
```
bằng:
```tsx
        <ChromeToanSite header={<Header />} dieuHuong={<ThanhDieuHuong />}>
          {children}
        </ChromeToanSite>
        <Analytics />
```
Thêm import ở đầu file: `import ChromeToanSite from "@/components/ChromeToanSite";`

- [ ] **Step 3: Build kiểm tra không lỗi TypeScript**

Chạy: `npm run build`
Kỳ vọng: build thành công, không lỗi type ở `layout.tsx`/`ChromeToanSite.tsx`.

- [ ] **Step 4: Kiểm chứng qua browser**

Mở trang chủ (`/`) — vẫn thấy Header + ThanhDieuHuong như cũ. Mở 1 trang đọc chương bất kỳ
(`/truyen/<slug>/chuong/1`) — Header và ThanhDieuHuong biến mất hoàn toàn, chỉ còn nội dung
`KhungDocChuong` (kể cả `PanelCaiDatDoc` cũ, sẽ tối giản hoá ở Task 3).

- [ ] **Step 5: Commit**

```bash
git add components/ChromeToanSite.tsx app/layout.tsx
git commit -m "feat: ẩn Header/ThanhDieuHuong ở trang đọc chương qua ChromeToanSite"
```

---

### Task 2: `ThanhDieuHuong.tsx` — biến thể mobile nằm ngang dưới đáy

**Files:**
- Modify: `components/ThanhDieuHuong.tsx`

**Interfaces:** không đổi props/export, chỉ đổi className theo breakpoint.

- [ ] **Step 1: Sửa JSX thành 2 biến thể responsive**

Thay toàn bộ nội dung hàm `ThanhDieuHuong` (giữ nguyên mảng `MUC` và phần đọc `pathname`) — đổi
phần `return`:

```tsx
  return (
    <>
      {/* Desktop: icon nổi dọc bên trái */}
      <nav className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2 p-2 rounded-full border border-border bg-surface shadow-md">
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

      {/* Mobile: thanh ngang cố định dưới đáy */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 justify-center gap-6 border-t border-border bg-surface py-2 shadow-md">
        {MUC.map((muc) => {
          const dangHoatDong = pathname === muc.duongDan;
          return (
            <Link
              key={muc.duongDan}
              href={muc.duongDan}
              aria-label={muc.nhan}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                dangHoatDong
                  ? 'bg-foreground text-background'
                  : 'text-foreground hover:bg-background'
              }`}
            >
              {muc.icon}
            </Link>
          );
        })}
      </nav>
    </>
  );
```

- [ ] **Step 2: Build kiểm tra**

Chạy: `npm run build` — không lỗi.

- [ ] **Step 3: Kiểm chứng qua browser**

Resize Browser pane về 375px, mở trang chủ: thấy thanh ngang dưới đáy với 3 icon căn giữa, icon
đang mở tô đậm đúng. Resize về desktop (>= 768px, ví dụ 1280px): thấy icon nổi dọc bên trái như
cũ, thanh ngang dưới đáy biến mất. Trang đọc chương (mọi kích thước): cả 2 biến thể đều không hiện
(do Task 1 đã ẩn từ `ChromeToanSite`).

- [ ] **Step 4: Commit**

```bash
git add components/ThanhDieuHuong.tsx
git commit -m "feat: thanh điều hướng responsive - ngang dưới đáy trên mobile"
```

---

### Task 3: Thanh top tối giản cho trang đọc chương + sửa bug vị trí "Aa"

**Files:**
- Modify: `app/truyen/[slug]/chuong/[so]/PanelCaiDatDoc.tsx`
- Modify: `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx`

**Interfaces:** không đổi props của `PanelCaiDatDoc`/`KhungDocChuong` trong task này (Task 4 sẽ
thêm props mới cho danh sách chương).

- [ ] **Step 1: Sửa vị trí trong `PanelCaiDatDoc.tsx`**

Đổi dòng:
```tsx
    <div ref={panelRef} className="absolute top-4 right-4 z-20">
```
thành:
```tsx
    <div ref={panelRef} className="fixed top-3 right-3 z-40">
```

- [ ] **Step 2: Thêm icon nhà cố định trong `KhungDocChuong.tsx`**

Thêm import `Link` đã có sẵn, thêm ngay trước dòng `<PanelCaiDatDoc ... />` trong JSX:

```tsx
      <Link
        href="/"
        aria-label="Về trang chủ"
        className="fixed top-3 left-3 z-40 w-9 h-9 rounded-full border flex items-center justify-center bg-white/80 text-gray-900"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </Link>
```

- [ ] **Step 3: Build kiểm tra**

Chạy: `npm run build` — không lỗi.

- [ ] **Step 4: Kiểm chứng qua browser (mobile 375px và 320px)**

Mở 1 trang đọc chương. Xác nhận: icon nhà góc trên-trái, nút "Aa" góc trên-phải, cả hai `fixed`
nên khi cuộn trang xuống vẫn giữ nguyên vị trí, không đè lên chữ chương (chữ bắt đầu đủ thấp dưới
2 nút nhờ `<p>`/`<h1>` đã có margin-top sẵn — nếu bị đè, thêm `pt-14` vào `<main>` trong
`KhungDocChuong.tsx`). Bấm "Aa" mở dropdown — không tràn ra ngoài mép phải màn hình ở cả 375px và
320px. Bấm icon nhà — điều hướng đúng về `/`.

- [ ] **Step 5: Commit**

```bash
git add "app/truyen/[slug]/chuong/[so]/PanelCaiDatDoc.tsx" "app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx"
git commit -m "fix: sửa vị trí nút Aa + thêm icon về trang chủ cố định trong trang đọc chương"
```

---

### Task 4: Nút "Danh sách chương" (dropdown tại chỗ)

**Files:**
- Create: `app/truyen/[slug]/chuong/[so]/DanhSachChuong.tsx`
- Modify: `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx`
- Modify: `app/truyen/[slug]/chuong/[so]/page.tsx`

**Interfaces:**
- `export type MucChuong = { soChuong: number; tieuDe: string }`
- `export default function DanhSachChuong({ slugTruyen, soChuongHienTai, dsChuong }: { slugTruyen:
  string; soChuongHienTai: number; dsChuong: MucChuong[] }): JSX.Element`
- `KhungDocChuong` nhận thêm prop `dsChuong: MucChuong[]`.

- [ ] **Step 1: Tạo `DanhSachChuong.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type MucChuong = { soChuong: number; tieuDe: string };

export default function DanhSachChuong({
  slugTruyen,
  soChuongHienTai,
  dsChuong,
}: {
  slugTruyen: string;
  soChuongHienTai: number;
  dsChuong: MucChuong[];
}) {
  const [moDanhSach, setMoDanhSach] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moDanhSach) return;

    function xuLyClickNgoai(suKien: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(suKien.target as Node)) {
        setMoDanhSach(false);
      }
    }

    document.addEventListener('mousedown', xuLyClickNgoai);
    return () => {
      document.removeEventListener('mousedown', xuLyClickNgoai);
    };
  }, [moDanhSach]);

  return (
    <div ref={boxRef} className="fixed top-3 left-14 z-40">
      <button
        type="button"
        onClick={() => setMoDanhSach((truoc) => !truoc)}
        aria-label="Danh sách chương"
        className="h-9 px-3 rounded-full border flex items-center justify-center text-xs font-semibold bg-white/80 text-gray-900"
      >
        Danh sách
      </button>
      {moDanhSach && (
        <div className="absolute left-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-lg border bg-white text-gray-900 shadow-lg z-40">
          {dsChuong.map((muc) => (
            <Link
              key={muc.soChuong}
              href={`/truyen/${slugTruyen}/chuong/${muc.soChuong}`}
              onClick={() => setMoDanhSach(false)}
              className={`block px-3 py-2 text-sm hover:bg-gray-100 ${
                muc.soChuong === soChuongHienTai ? 'font-bold text-blue-600' : ''
              }`}
            >
              Chương {muc.soChuong}: {muc.tieuDe}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Truyền `dsChuong` từ `page.tsx`**

Trong `app/truyen/[slug]/chuong/[so]/page.tsx`, sau đoạn lấy `chuongTruoc`/`chuongSau`, thêm:

```tsx
  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });
```

Sửa `<KhungDocChuong ... />` thêm prop:
```tsx
        dsChuong={(dsChuong ?? []).map((c) => ({ soChuong: c.so_chuong, tieuDe: c.tieu_de }))}
```

- [ ] **Step 3: Wire vào `KhungDocChuong.tsx`**

Thêm import: `import DanhSachChuong, { type MucChuong } from './DanhSachChuong';`

Thêm `dsChuong: MucChuong[];` vào type props và destructure tham số hàm.

Thêm ngay sau thẻ `<Link>` icon nhà (Task 3) trong JSX:
```tsx
      <DanhSachChuong
        slugTruyen={slugTruyen}
        soChuongHienTai={soChuong}
        dsChuong={dsChuong}
      />
```

- [ ] **Step 4: Build kiểm tra**

Chạy: `npm run build` — không lỗi type (đối chiếu tên prop `dsChuong`/`MucChuong` khớp đúng giữa
3 file).

- [ ] **Step 5: Kiểm chứng qua browser (375px)**

Mở trang đọc chương, bấm nút "Danh sách" cạnh icon nhà — dropdown hiện đủ số chương, cuộn được nếu
truyện dài, chương hiện tại tô đậm màu xanh, bấm 1 chương khác điều hướng đúng và đóng dropdown.
Bấm ra ngoài dropdown tự đóng.

- [ ] **Step 6: Commit**

```bash
git add "app/truyen/[slug]/chuong/[so]/DanhSachChuong.tsx" "app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx" "app/truyen/[slug]/chuong/[so]/page.tsx"
git commit -m "feat: thêm nút Danh sách chương dạng dropdown trong trang đọc"
```

---

### Task 5: Làm nổi bật nút "Chương trước"/"Chương sau"

**Files:**
- Modify: `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx`

- [ ] **Step 1: Đổi style khối `<nav>` điều hướng chương**

Thay:
```tsx
      <nav className="mt-6 flex justify-between">
        {soChuongTruoc ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${soChuongTruoc}`}
            className="hover:underline"
          >
            ← Chương trước
          </Link>
        ) : (
          <span />
        )}
        {soChuongSau ? (
          <Link href={`/truyen/${slugTruyen}/chuong/${soChuongSau}`} className="hover:underline">
            Chương sau →
          </Link>
        ) : (
          <span />
        )}
      </nav>
```
bằng:
```tsx
      <nav className="mt-6 flex justify-between gap-3">
        {soChuongTruoc ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${soChuongTruoc}`}
            className="flex-1 min-h-11 flex items-center justify-center rounded-lg border border-border font-medium hover:bg-black/5"
          >
            ← Chương trước
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {soChuongSau ? (
          <Link
            href={`/truyen/${slugTruyen}/chuong/${soChuongSau}`}
            className="flex-1 min-h-11 flex items-center justify-center rounded-lg border border-border font-medium hover:bg-black/5"
          >
            Chương sau →
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
```

- [ ] **Step 2: Build kiểm tra**

Chạy: `npm run build` — không lỗi.

- [ ] **Step 3: Kiểm chứng qua browser**

2 nút giờ có viền rõ ràng, chiều cao tối thiểu 44px (`min-h-11` = 44px trong Tailwind mặc định),
dễ bấm bằng ngón tay trên mobile 375px.

- [ ] **Step 4: Commit**

```bash
git add "app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx"
git commit -m "feat: làm nổi bật nút Chương trước/sau bằng nút có viền"
```

---

### Task 6: Trang truyện — nút "Bắt đầu đọc"

**Files:**
- Modify: `app/truyen/[slug]/page.tsx`

- [ ] **Step 1: Tính chương nhỏ nhất và đổi khối nút**

Sau dòng lấy `dsChuong` hiện có, thêm:
```tsx
  const chuongDauTien = (dsChuong ?? [])[0] ?? null;
```
(danh sách đã `order('so_chuong', { ascending: true })` sẵn nên phần tử đầu là chương nhỏ nhất).

Thay khối:
```tsx
      {chuongDangDoc && (
        <Link
          href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
          className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 text-white"
        >
          Đọc tiếp Chương {chuongDangDoc.so_chuong}
        </Link>
      )}
```
bằng:
```tsx
      <div className="mt-4 flex flex-wrap gap-3">
        {chuongDauTien && (
          <Link
            href={`/truyen/${slug}/chuong/${chuongDauTien.so_chuong}`}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium"
          >
            Bắt đầu đọc
          </Link>
        )}
        {chuongDangDoc && (
          <Link
            href={`/truyen/${slug}/chuong/${chuongDangDoc.so_chuong}`}
            className="px-4 py-2 rounded border border-border font-medium hover:bg-black/5"
          >
            Đọc tiếp Chương {chuongDangDoc.so_chuong}
          </Link>
        )}
      </div>
```

- [ ] **Step 2: Build kiểm tra**

Chạy: `npm run build` — không lỗi.

- [ ] **Step 3: Kiểm chứng qua browser**

Truyện có chương: thấy nút "Bắt đầu đọc" luôn hiện, bấm vào đúng chương số nhỏ nhất. Đăng nhập +
đã đọc dở 1 truyện: thấy thêm nút "Đọc tiếp Chương N" cạnh nút Bắt đầu đọc. Khách/chưa đọc: chỉ
thấy "Bắt đầu đọc".

- [ ] **Step 4: Commit**

```bash
git add "app/truyen/[slug]/page.tsx"
git commit -m "feat: thêm nút Bắt đầu đọc ở trang truyện"
```

---

### Task 7: Trang truyện — khối "Giới thiệu truyện" thu gọn/xem thêm

**Files:**
- Create: `app/truyen/[slug]/MoTaTruyen.tsx`
- Modify: `app/truyen/[slug]/page.tsx`

**Interfaces:**
- `export default function MoTaTruyen({ moTa }: { moTa: string }): JSX.Element`

- [ ] **Step 1: Tạo `MoTaTruyen.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export default function MoTaTruyen({ moTa }: { moTa: string }) {
  const [moRong, setMoRong] = useState(false);
  const [canThuGon, setCanThuGon] = useState(false);
  const noiDungRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = noiDungRef.current;
    if (!el) return;
    setCanThuGon(el.scrollHeight > el.clientHeight + 1);
  }, [moTa]);

  return (
    <section className="mt-4">
      <h2 className="font-bold text-lg mb-2">Giới thiệu truyện</h2>
      <p
        ref={noiDungRef}
        className={`text-muted-foreground whitespace-pre-line ${moRong ? '' : 'line-clamp-4'}`}
      >
        {moTa}
      </p>
      {(canThuGon || moRong) && (
        <button
          type="button"
          onClick={() => setMoRong((truoc) => !truoc)}
          className="mt-1 text-sm text-blue-600 hover:underline"
        >
          {moRong ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire vào `page.tsx`**

Thêm import: `import MoTaTruyen from './MoTaTruyen';`

Thay dòng:
```tsx
      {truyen.mo_ta && <p className="mt-4 text-muted-foreground whitespace-pre-line">{truyen.mo_ta}</p>}
```
bằng:
```tsx
      {truyen.mo_ta && <MoTaTruyen moTa={truyen.mo_ta} />}
```

- [ ] **Step 3: Build kiểm tra**

Chạy: `npm run build` — không lỗi. Lưu ý: `line-clamp-4` là tiện ích Tailwind v4 dựng sẵn (không
cần plugin `@tailwindcss/line-clamp` như v3) — nếu build báo class không nhận, kiểm tra
`tailwindcss` version trong `package.json` (đã là `^4`, nên mặc định có sẵn).

- [ ] **Step 4: Kiểm chứng qua browser**

Mở 1 truyện có mô tả dài (> 4 dòng ở độ rộng mobile 375px): thấy tiêu đề "Giới thiệu truyện", nội
dung bị cắt 4 dòng, có nút "Xem thêm" — bấm vào hiện đầy đủ + đổi thành "Thu gọn" — bấm lại thu về
4 dòng. Mở 1 truyện có mô tả ngắn (không tràn 4 dòng): không thấy nút Xem thêm/Thu gọn.

- [ ] **Step 5: Commit**

```bash
git add "app/truyen/[slug]/MoTaTruyen.tsx" "app/truyen/[slug]/page.tsx"
git commit -m "feat: tách khối Giới thiệu truyện với xem thêm/thu gọn"
```

---

### Task 8: Kiểm chứng tổng thể + hồi quy

**Files:** không tạo/sửa file mới — chỉ chạy kiểm tra.

- [ ] **Step 1: Build + test toàn bộ**

Chạy: `npm run build` — kỳ vọng thành công, 0 lỗi type.
Chạy: `npm run test` (hoặc `npx vitest run`) — kỳ vọng toàn bộ test hiện có (52 test tính đến
2026-09-13) vẫn pass, không cần thêm test mới cho các thay đổi UI thuần trong plan này.

- [ ] **Step 2: Kiểm chứng qua Browser pane — resize 375px**

- Trang chủ: thanh điều hướng ngang dưới đáy, Header đầy đủ phía trên vẫn còn.
- Trang truyện (1 truyện có mô tả dài): nút Bắt đầu đọc (+ Đọc tiếp nếu đã đăng nhập có tiến độ),
  khối Giới thiệu truyện có tiêu đề + xem thêm/thu gọn.
- Trang đọc chương: không Header, không thanh điều hướng nổi/ngang; chỉ icon nhà + nút Danh sách +
  nút Aa cố định trên cùng, không đè chữ khi cuộn; nút Chương trước/sau nổi bật, dễ bấm.

- [ ] **Step 3: Kiểm chứng qua Browser pane — resize 320px (màn hình rất hẹp)**

Lặp lại các điểm ở Step 2, đặc biệt xác nhận dropdown "Aa" và "Danh sách chương" không tràn ra
ngoài mép phải/trái màn hình.

- [ ] **Step 4: Kiểm chứng desktop (>= 768px) không hồi quy**

Trang chủ/trang truyện: thanh điều hướng trở lại kiểu icon nổi dọc bên trái như trước khi có plan
này. Trang đọc chương: vẫn ẩn Header/thanh điều hướng đúng như mobile (không phụ thuộc kích thước
màn hình, chỉ phụ thuộc route).

- [ ] **Step 5: Console sạch lỗi**

Mở tab trình duyệt mới hoàn toàn (không dùng tab cũ đang HMR) cho cả 3 loại trang trên, xác nhận
không có lỗi JS trong console.

- [ ] **Step 6: Báo cáo hoàn tất**

Không cần commit (task này chỉ kiểm tra) — nếu phát hiện lỗi ở bước nào, quay lại đúng Task tương
ứng để sửa trước khi coi plan là hoàn tất.
