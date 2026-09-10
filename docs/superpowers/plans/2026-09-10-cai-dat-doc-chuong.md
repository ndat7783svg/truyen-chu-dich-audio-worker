# Cài đặt đọc trong trang chương Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user tự tùy chỉnh màu nền, cỡ chữ, phông chữ, giãn dòng bên trong trang đọc
chương (không ảnh hưởng trang khác), lưu cài đặt qua `localStorage`.

**Architecture:** Tách phần render JSX của `page.tsx` (Server Component, giữ nguyên fetch dữ liệu)
ra 1 client component `KhungDocChuong` quản lý state cài đặt + áp dụng style, cộng 1 client
component con `PanelCaiDatDoc` là UI nút bánh răng + dropdown điều khiển. Logic đọc/ghi
`localStorage` và chuẩn hóa dữ liệu tách thành module thuần `lib/utils/cai-dat-doc.ts` để unit
test được (TDD).

**Tech Stack:** Next.js App Router (React Server + Client Components), Tailwind CSS v4,
`next/font/google` (Noto Serif), Vitest.

## Global Constraints

- Chỉ lưu cài đặt trong `localStorage` trình duyệt hiện tại — không lưu theo tài khoản/Supabase.
- Phạm vi áp dụng style chỉ trong khung đọc chương (`app/truyen/[slug]/chuong/[so]/`) — không đụng
  `components/Header.tsx` hay bất kỳ trang nào khác.
- Đọc/ghi `localStorage` phải bọc `try/catch`, lỗi thì im lặng fallback về mặc định — không throw,
  không hiện lỗi cho user.
- Không thêm dependency mới ngoài những gì đã có sẵn trong `next` (dùng `next/font/google`, không
  cài package ngoài).
- Không được phá vỡ luồng ghi lượt xem (`ghi_luot_xem` RPC) và lưu tiến độ đọc (`LuuTienDo`) đang
  hoạt động trong `page.tsx`.
- Giá trị chính xác theo spec `docs/superpowers/specs/2026-09-10-cai-dat-doc-chuong-design.md`:
  - Màu nền: Sáng `#ffffff`/`#111827` · Vàng `#f4ecd8`/`#5b4636` · Tối `#1a1a1a`/`#e5e5e5`.
  - Cỡ chữ: 16–32px, mặc định 18px, bước 1px.
  - Giãn dòng: 1.5–2.5, mặc định 1.75, bước 0.25.
  - Phông: Hiện đại = mặc định site (không đổi), Cổ điển = `Noto Serif` (subset `vietnamese` +
    `latin`).

---

### Task 1: Module thuần `cai-dat-doc` (types, chuẩn hóa, đọc/ghi localStorage, màu theo theme)

**Files:**
- Create: `lib/utils/cai-dat-doc.ts`
- Test: `lib/utils/cai-dat-doc.test.ts`

**Interfaces:**
- Produces (dùng ở Task 2 và Task 3):
  - `type MauNen = 'sang' | 'vang' | 'toi'`
  - `type Phong = 'hien-dai' | 'co-dien'`
  - `type CaiDatDoc = { mauNen: MauNen; coChu: number; phong: Phong; giaiDong: number }`
  - `const CAI_DAT_MAC_DINH: CaiDatDoc`
  - `const GIOI_HAN_CO_CHU: { min: number; max: number }` (16, 32)
  - `const GIOI_HAN_GIAI_DONG: { min: number; max: number }` (1.5, 2.5)
  - `function chuanHoaCaiDatDoc(input: unknown): CaiDatDoc`
  - `function docCaiDatDoc(): CaiDatDoc`
  - `function ghiCaiDatDoc(caiDat: CaiDatDoc): void`
  - `function mauSacTheo(mauNen: MauNen): { nen: string; chu: string }`

- [ ] **Step 1: Viết test cho toàn bộ module (chưa có file nguồn)**

Tạo `lib/utils/cai-dat-doc.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAI_DAT_MAC_DINH,
  chuanHoaCaiDatDoc,
  docCaiDatDoc,
  ghiCaiDatDoc,
  mauSacTheo,
} from './cai-dat-doc';

function taoLocalStorageGia() {
  const luuTru = new Map<string, string>();
  return {
    getItem: (key: string) => luuTru.get(key) ?? null,
    setItem: (key: string, value: string) => {
      luuTru.set(key, value);
    },
    removeItem: (key: string) => {
      luuTru.delete(key);
    },
    clear: () => {
      luuTru.clear();
    },
  };
}

describe('chuanHoaCaiDatDoc', () => {
  it('trả về mặc định khi input không phải object', () => {
    expect(chuanHoaCaiDatDoc(null)).toEqual(CAI_DAT_MAC_DINH);
    expect(chuanHoaCaiDatDoc('chuoi')).toEqual(CAI_DAT_MAC_DINH);
  });

  it('trả về mặc định cho từng trường không hợp lệ, giữ nguyên trường hợp lệ', () => {
    const ketQua = chuanHoaCaiDatDoc({
      mauNen: 'toi',
      coChu: 999,
      phong: 'co-dien',
      giaiDong: -1,
    });
    expect(ketQua).toEqual({
      mauNen: 'toi',
      coChu: CAI_DAT_MAC_DINH.coChu,
      phong: 'co-dien',
      giaiDong: CAI_DAT_MAC_DINH.giaiDong,
    });
  });

  it('giữ nguyên toàn bộ khi input hợp lệ', () => {
    const hopLe = { mauNen: 'vang' as const, coChu: 24, phong: 'hien-dai' as const, giaiDong: 2 };
    expect(chuanHoaCaiDatDoc(hopLe)).toEqual(hopLe);
  });
});

describe('docCaiDatDoc / ghiCaiDatDoc', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', taoLocalStorageGia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trả về mặc định khi chưa lưu gì', () => {
    expect(docCaiDatDoc()).toEqual(CAI_DAT_MAC_DINH);
  });

  it('ghi rồi đọc lại đúng giá trị', () => {
    const caiDat = { mauNen: 'toi' as const, coChu: 20, phong: 'co-dien' as const, giaiDong: 2 };
    ghiCaiDatDoc(caiDat);
    expect(docCaiDatDoc()).toEqual(caiDat);
  });

  it('trả về mặc định khi dữ liệu lưu trữ là JSON hỏng', () => {
    localStorage.setItem('caiDatDocTruyen', '{khong-hop-le');
    expect(docCaiDatDoc()).toEqual(CAI_DAT_MAC_DINH);
  });

  it('không throw khi localStorage báo lỗi', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bị chặn');
      },
      setItem: () => {
        throw new Error('bị chặn');
      },
    });
    expect(() => docCaiDatDoc()).not.toThrow();
    expect(docCaiDatDoc()).toEqual(CAI_DAT_MAC_DINH);
    expect(() => ghiCaiDatDoc(CAI_DAT_MAC_DINH)).not.toThrow();
  });
});

describe('mauSacTheo', () => {
  it('trả đúng màu cho từng theme', () => {
    expect(mauSacTheo('sang')).toEqual({ nen: '#ffffff', chu: '#111827' });
    expect(mauSacTheo('vang')).toEqual({ nen: '#f4ecd8', chu: '#5b4636' });
    expect(mauSacTheo('toi')).toEqual({ nen: '#1a1a1a', chu: '#e5e5e5' });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL vì chưa có module nguồn**

Run: `npx vitest run lib/utils/cai-dat-doc.test.ts`
Expected: FAIL với lỗi kiểu "Cannot find module './cai-dat-doc'"

- [ ] **Step 3: Viết implementation**

Tạo `lib/utils/cai-dat-doc.ts`:

```ts
export type MauNen = 'sang' | 'vang' | 'toi';
export type Phong = 'hien-dai' | 'co-dien';

export type CaiDatDoc = {
  mauNen: MauNen;
  coChu: number;
  phong: Phong;
  giaiDong: number;
};

export const CAI_DAT_MAC_DINH: CaiDatDoc = {
  mauNen: 'sang',
  coChu: 18,
  phong: 'hien-dai',
  giaiDong: 1.75,
};

export const GIOI_HAN_CO_CHU = { min: 16, max: 32 };
export const GIOI_HAN_GIAI_DONG = { min: 1.5, max: 2.5 };

const KHOA_LUU_TRU = 'caiDatDocTruyen';

export function chuanHoaCaiDatDoc(input: unknown): CaiDatDoc {
  if (typeof input !== 'object' || input === null) return CAI_DAT_MAC_DINH;
  const obj = input as Record<string, unknown>;

  const mauNen: MauNen =
    obj.mauNen === 'sang' || obj.mauNen === 'vang' || obj.mauNen === 'toi'
      ? obj.mauNen
      : CAI_DAT_MAC_DINH.mauNen;

  const phong: Phong =
    obj.phong === 'hien-dai' || obj.phong === 'co-dien' ? obj.phong : CAI_DAT_MAC_DINH.phong;

  const coChu =
    typeof obj.coChu === 'number' &&
    obj.coChu >= GIOI_HAN_CO_CHU.min &&
    obj.coChu <= GIOI_HAN_CO_CHU.max
      ? obj.coChu
      : CAI_DAT_MAC_DINH.coChu;

  const giaiDong =
    typeof obj.giaiDong === 'number' &&
    obj.giaiDong >= GIOI_HAN_GIAI_DONG.min &&
    obj.giaiDong <= GIOI_HAN_GIAI_DONG.max
      ? obj.giaiDong
      : CAI_DAT_MAC_DINH.giaiDong;

  return { mauNen, coChu, phong, giaiDong };
}

export function docCaiDatDoc(): CaiDatDoc {
  try {
    const raw = localStorage.getItem(KHOA_LUU_TRU);
    if (!raw) return CAI_DAT_MAC_DINH;
    return chuanHoaCaiDatDoc(JSON.parse(raw));
  } catch {
    return CAI_DAT_MAC_DINH;
  }
}

export function ghiCaiDatDoc(caiDat: CaiDatDoc): void {
  try {
    localStorage.setItem(KHOA_LUU_TRU, JSON.stringify(caiDat));
  } catch {
    // localStorage không khả dụng - cài đặt chỉ tồn tại trong phiên hiện tại
  }
}

export function mauSacTheo(mauNen: MauNen): { nen: string; chu: string } {
  switch (mauNen) {
    case 'vang':
      return { nen: '#f4ecd8', chu: '#5b4636' };
    case 'toi':
      return { nen: '#1a1a1a', chu: '#e5e5e5' };
    case 'sang':
    default:
      return { nen: '#ffffff', chu: '#111827' };
  }
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run lib/utils/cai-dat-doc.test.ts`
Expected: PASS toàn bộ (10 test)

- [ ] **Step 5: Commit**

```bash
git add lib/utils/cai-dat-doc.ts lib/utils/cai-dat-doc.test.ts
git commit -m "feat: module thuan doc/ghi cai dat doc chuong (localStorage)"
```

---

### Task 2: Component UI `PanelCaiDatDoc` + `KhungDocChuong`

**Files:**
- Create: `app/truyen/[slug]/chuong/[so]/PanelCaiDatDoc.tsx`
- Create: `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx`

**Interfaces:**
- Consumes (từ Task 1): `CaiDatDoc`, `MauNen`, `Phong`, `CAI_DAT_MAC_DINH`, `GIOI_HAN_CO_CHU`,
  `GIOI_HAN_GIAI_DONG`, `docCaiDatDoc()`, `ghiCaiDatDoc(caiDat)`, `mauSacTheo(mauNen)` từ
  `@/lib/utils/cai-dat-doc`.
- Produces (dùng ở Task 3):
  - `PanelCaiDatDoc(props: { caiDat: CaiDatDoc; onDoiCaiDat: (caiDatMoi: CaiDatDoc) => void })`
  - `KhungDocChuong(props: { tenTruyen: string; slugTruyen: string; soChuong: number; tieuDe:
    string; noiDung: string; soChuongTruoc?: number; soChuongSau?: number })`

Không có unit test tự động cho 2 component UI này (dự án chưa có thư viện test React) — xác nhận
đúng bằng TypeScript build ở Step cuối và kiểm chứng browser thật ở Task 3.

- [ ] **Step 1: Tạo `PanelCaiDatDoc.tsx`**

```tsx
'use client';

import { useState } from 'react';
import {
  GIOI_HAN_CO_CHU,
  GIOI_HAN_GIAI_DONG,
  type CaiDatDoc,
  type MauNen,
  type Phong,
} from '@/lib/utils/cai-dat-doc';

export default function PanelCaiDatDoc({
  caiDat,
  onDoiCaiDat,
}: {
  caiDat: CaiDatDoc;
  onDoiCaiDat: (caiDatMoi: CaiDatDoc) => void;
}) {
  const [moPanel, setMoPanel] = useState(false);

  function doiMauNen(mauNen: MauNen) {
    onDoiCaiDat({ ...caiDat, mauNen });
  }

  function doiCoChu(coChu: number) {
    const gioiHan = Math.min(GIOI_HAN_CO_CHU.max, Math.max(GIOI_HAN_CO_CHU.min, coChu));
    onDoiCaiDat({ ...caiDat, coChu: gioiHan });
  }

  function doiPhong(phong: Phong) {
    onDoiCaiDat({ ...caiDat, phong });
  }

  function doiGiaiDong(giaiDong: number) {
    onDoiCaiDat({ ...caiDat, giaiDong });
  }

  return (
    <div className="absolute top-4 right-4">
      <button
        type="button"
        onClick={() => setMoPanel((truoc) => !truoc)}
        aria-label="Cài đặt đọc"
        className="w-9 h-9 rounded-full border flex items-center justify-center text-sm font-semibold bg-white/80 text-gray-900"
      >
        Aa
      </button>
      {moPanel && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-white text-gray-900 p-4 shadow-lg space-y-4 z-10">
          <div>
            <p className="text-xs font-semibold uppercase mb-2">Màu nền</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doiMauNen('sang')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.mauNen === 'sang' ? 'border-blue-500' : ''}`}
              >
                Sáng
              </button>
              <button
                type="button"
                onClick={() => doiMauNen('vang')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.mauNen === 'vang' ? 'border-blue-500' : ''}`}
              >
                Vàng
              </button>
              <button
                type="button"
                onClick={() => doiMauNen('toi')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.mauNen === 'toi' ? 'border-blue-500' : ''}`}
              >
                Tối
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">
              Cỡ chữ nội dung <span className="normal-case font-normal">{caiDat.coChu}px</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => doiCoChu(caiDat.coChu - 1)}
                aria-label="Giảm cỡ chữ"
                className="w-7 h-7 rounded-full border"
              >
                A-
              </button>
              <input
                type="range"
                min={GIOI_HAN_CO_CHU.min}
                max={GIOI_HAN_CO_CHU.max}
                step={1}
                value={caiDat.coChu}
                onChange={(e) => doiCoChu(Number(e.target.value))}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => doiCoChu(caiDat.coChu + 1)}
                aria-label="Tăng cỡ chữ"
                className="w-7 h-7 rounded-full border"
              >
                A+
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">Phông chữ</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doiPhong('hien-dai')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.phong === 'hien-dai' ? 'border-blue-500' : ''}`}
              >
                Hiện đại
              </button>
              <button
                type="button"
                onClick={() => doiPhong('co-dien')}
                className={`flex-1 border rounded p-2 text-xs ${caiDat.phong === 'co-dien' ? 'border-blue-500' : ''}`}
              >
                Cổ điển
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2">
              Giãn dòng{' '}
              <span className="normal-case font-normal">{caiDat.giaiDong.toFixed(2)}</span>
            </p>
            <input
              type="range"
              min={GIOI_HAN_GIAI_DONG.min}
              max={GIOI_HAN_GIAI_DONG.max}
              step={0.25}
              value={caiDat.giaiDong}
              onChange={(e) => doiGiaiDong(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `KhungDocChuong.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Noto_Serif } from 'next/font/google';
import {
  CAI_DAT_MAC_DINH,
  docCaiDatDoc,
  ghiCaiDatDoc,
  mauSacTheo,
  type CaiDatDoc,
} from '@/lib/utils/cai-dat-doc';
import PanelCaiDatDoc from './PanelCaiDatDoc';

const notoSerif = Noto_Serif({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '700'],
});

export default function KhungDocChuong({
  tenTruyen,
  slugTruyen,
  soChuong,
  tieuDe,
  noiDung,
  soChuongTruoc,
  soChuongSau,
}: {
  tenTruyen: string;
  slugTruyen: string;
  soChuong: number;
  tieuDe: string;
  noiDung: string;
  soChuongTruoc?: number;
  soChuongSau?: number;
}) {
  const [caiDat, setCaiDat] = useState<CaiDatDoc>(CAI_DAT_MAC_DINH);

  useEffect(() => {
    setCaiDat(docCaiDatDoc());
  }, []);

  function capNhatCaiDat(caiDatMoi: CaiDatDoc) {
    setCaiDat(caiDatMoi);
    ghiCaiDatDoc(caiDatMoi);
  }

  const mauSac = mauSacTheo(caiDat.mauNen);

  return (
    <main
      className="w-full max-w-2xl mx-auto p-4 relative"
      style={{
        backgroundColor: mauSac.nen,
        color: mauSac.chu,
        fontFamily: caiDat.phong === 'co-dien' ? notoSerif.style.fontFamily : undefined,
      }}
    >
      <PanelCaiDatDoc caiDat={caiDat} onDoiCaiDat={capNhatCaiDat} />
      <p className="text-sm opacity-70">
        <Link href={`/truyen/${slugTruyen}`} className="hover:underline">
          {tenTruyen}
        </Link>
      </p>
      <h1 className="text-xl font-bold mt-1">
        Chương {soChuong}: {tieuDe}
      </h1>
      <article
        className="mt-4 whitespace-pre-line"
        style={{ fontSize: `${caiDat.coChu}px`, lineHeight: caiDat.giaiDong }}
      >
        {noiDung}
      </article>
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
    </main>
  );
}
```

- [ ] **Step 3: Kiểm tra TypeScript build (component chưa được `page.tsx` import nên chỉ kiểm tra
  cú pháp/kiểu qua `tsc`, chưa cần build toàn app thành công ở bước này)**

Run: `npx tsc --noEmit`
Expected: Không có lỗi liên quan đến 2 file vừa tạo (có thể còn lỗi "declared but never read" nếu
tsconfig bật `noUnusedLocals` — nếu có, bỏ qua vì sẽ hết khi Task 3 import chúng vào `page.tsx`)

- [ ] **Step 4: Commit**

```bash
git add "app/truyen/[slug]/chuong/[so]/PanelCaiDatDoc.tsx" "app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx"
git commit -m "feat: component PanelCaiDatDoc va KhungDocChuong (chua wire vao page)"
```

---

### Task 3: Wire vào `page.tsx` + build + full test suite

**Files:**
- Modify: `app/truyen/[slug]/chuong/[so]/page.tsx`

**Interfaces:**
- Consumes (từ Task 2): `KhungDocChuong` component với props như định nghĩa ở Task 2.

- [ ] **Step 1: Sửa `page.tsx` — thay JSX cũ bằng `KhungDocChuong`**

Thay toàn bộ phần `return (...)` hiện tại (dòng 75-104 của file gốc) bằng:

```tsx
import KhungDocChuong from './KhungDocChuong';
```

Thêm import này ở đầu file (cạnh `import LuuTienDo from './LuuTienDo';`), rồi thay khối `return`
cuối hàm `TrangDocChuong` thành:

```tsx
  return (
    <>
      <LuuTienDo truyenId={truyen.id} chuongId={chuong.id} />
      <KhungDocChuong
        tenTruyen={truyen.ten}
        slugTruyen={slug}
        soChuong={chuong.so_chuong}
        tieuDe={chuong.tieu_de}
        noiDung={chuong.noi_dung}
        soChuongTruoc={chuongTruoc?.so_chuong}
        soChuongSau={chuongSau?.so_chuong}
      />
    </>
  );
```

Giữ nguyên toàn bộ phần fetch dữ liệu phía trên (không đổi).

- [ ] **Step 2: Build toàn app**

Run: `npm run build`
Expected: Build thành công, không có lỗi TypeScript/ESLint chặn build.

- [ ] **Step 3: Chạy toàn bộ test suite**

Run: `npx vitest run`
Expected: PASS toàn bộ, bao gồm 10 test mới của `cai-dat-doc.test.ts` cộng các test đã có từ
trước (`format.test.ts`, `dich-loi-supabase.test.ts`, `parse-thong-tin.test.js` nếu có,
`smoke.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add "app/truyen/[slug]/chuong/[so]/page.tsx"
git commit -m "feat: gan KhungDocChuong vao trang doc chuong"
```

---

## Kiểm chứng thật (Claude tự làm sau khi code xong, không phải task giao Antigravity)

Sau khi 3 task trên hoàn tất và build/test sạch, Claude cần tự mở trình duyệt (Browser preview)
vào 1 trang đọc chương thật và kiểm tra:

1. Bấm nút "Aa" → panel mở ra đúng vị trí, đủ 4 mục (Màu nền/Cỡ chữ/Phông/Giãn dòng).
2. Đổi từng mục → nội dung chương áp dụng thay đổi ngay lập tức, đúng giá trị.
3. Reload trang → cài đặt vừa đổi được giữ nguyên (đọc lại từ `localStorage`).
4. Kiểm tra tương phản chữ/nền dễ đọc ở cả 3 theme Sáng/Vàng/Tối.
5. Kiểm tra Header (logo, dropdown thể loại, đăng nhập/đăng xuất) ở đầu trang không bị đổi màu/kiểu
   theo cài đặt này.
6. Mở DevTools Console — không có lỗi JS khi mở panel, đổi cài đặt, hoặc reload.
