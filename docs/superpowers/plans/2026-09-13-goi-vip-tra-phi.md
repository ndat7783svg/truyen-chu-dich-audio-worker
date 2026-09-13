# Hệ thống trả phí / Gói VIP (bản thủ công v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi bộ truyện cho đọc free 50 chương đầu; từ chương 51 trở đi cần tài khoản có gói VIP đang
hiệu lực (3 gói theo thời gian: 1/7/30 ngày). Thanh toán v1 làm thủ công qua MoMo cá nhân + mã giao
dịch, chủ site tự chạy 1 script CLI để nâng cấp tài khoản sau khi nhận tiền — không tích hợp PayOS ở
plan này.

**Architecture:** Thêm 2 cột (`goi_loai`, `goi_het_han`) vào bảng `nguoi_dung` để biết trạng thái gói
hiện tại (check nhanh 1 điều kiện khi gate chương), và bảng `giao_dich` lưu lịch sử đơn hàng để đối
soát. Client tạo đơn qua server action (RLS cho phép user tự insert đơn của mình), hiển thị mã giao
dịch + QR nhận tiền tĩnh, chủ site tự đối chiếu MoMo rồi chạy script CLI (dùng service role key) để
đánh dấu đã thanh toán + nâng hạn gói. Một trigger DB chặn user tự sửa `goi_loai`/`goi_het_han` qua
API thường (chỉ service role mới sửa được).

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase Postgres (RLS +
trigger), TypeScript, Tailwind CSS, Node.js script (`@supabase/supabase-js` service role client),
Vitest.

## Global Constraints
- Free 50 chương đầu mỗi truyện; truyện có ít hơn 50 chương thì free toàn bộ.
- 3 gói giá cố định trong code: Gói ngày 1 ngày 6.000đ, Gói tuần 7 ngày 39.000đ, Gói tháng 30 ngày
  162.000đ.
- Kích hoạt gói nào mở toàn bộ mọi truyện không giới hạn chương trong thời gian đó (không giới hạn
  theo từng truyện).
- Mua gói mới **thay thế** hạn cũ (không cộng dồn thời gian).
- Hết hạn tính theo giờ chính xác (timestamp), không làm tròn theo ngày lịch.
- Gói VIP gắn với tài khoản (`nguoi_dung`) — chương >50 bắt buộc đăng nhập mới xem được.
- v1 KHÔNG tích hợp PayOS/webhook tự động — thanh toán thủ công qua MoMo cá nhân + script CLI xác
  nhận. Không làm trang admin, không đối chiếu số tiền tự động, không thông báo real-time.
- Không dùng thư viện ngoài nào chưa có trong `package.json` cho phần này.

---

## File Structure

- `supabase/schema.sql` — thêm cột `nguoi_dung.goi_loai`/`goi_het_han`, bảng `giao_dich`, trigger
  chặn tự sửa gói (modify, append cuối file).
- `lib/config/goi-vip.ts` — cấu hình 3 gói + `SO_CHUONG_FREE` (create).
- `lib/utils/gia-han-vip.ts` — hàm thuần `tinhHanMoi`/`conHieuLucGoi`/`sinhMaGiaoDich` (create).
- `lib/utils/gia-han-vip.test.ts` — test cho file trên (create).
- `app/tai-khoan/actions-goi-vip.ts` — server action `taoGiaoDich` (create).
- `components/ChonGoiVip.tsx` — modal chọn gói + hiển thị hướng dẫn chuyển khoản, dùng chung ở trang
  Tài khoản và trang chặn chương (create).
- `app/tai-khoan/page.tsx` — thêm mục "Gói VIP" (modify).
- `app/truyen/[slug]/chuong/[so]/page.tsx` — gate chương >50 theo gói (modify).
- `app/truyen/[slug]/chuong/[so]/ChanChuongVip.tsx` — trang/khối chặn khi chưa có gói (create).
- `app/truyen/[slug]/page.tsx` — icon khoá cho chương >50 khi chưa có gói (modify).
- `scripts/xac-nhan-thanh-toan-logic.js` — hàm thuần tính hạn mới + bảng tra gói (create).
- `scripts/xac-nhan-thanh-toan-logic.test.js` — test cho file trên (create).
- `scripts/xac-nhan-thanh-toan.mjs` — CLI xác nhận thanh toán, dùng service role key (create).
- `public/qr-nhan-tien-momo.png` — **user tự cung cấp** ảnh QR nhận tiền MoMo cá nhân (không phải
  code, nhắc ở Task 4).
- `NEXT_SESSION.md`, `PROJECT_MAP.md`, `CLAUDE.md` — cập nhật trạng thái, ghi rõ PayOS hoãn sang
  phiên sau (modify, Task 9).

---

### Task 1: Schema DB — cột gói VIP + bảng giao dịch + trigger chặn tự sửa

**Files:**
- Modify: `supabase/schema.sql` (append cuối file)

**Interfaces:**
- Produces: cột `nguoi_dung.goi_loai` (text, null), `nguoi_dung.goi_het_han` (timestamptz, null);
  bảng `giao_dich` (`id`, `nguoi_dung_id`, `ma_giao_dich` unique, `goi_loai`, `so_tien`,
  `trang_thai` mặc định `'cho_thanh_toan'`, `tao_luc`, `thanh_toan_luc`).

- [ ] **Step 1: Append SQL vào cuối `supabase/schema.sql`**

```sql

-- Hệ thống gói VIP (2026-09-13, bản thủ công v1 — chưa tích hợp PayOS)
alter table nguoi_dung add column if not exists goi_loai text;
alter table nguoi_dung add column if not exists goi_het_han timestamptz;

-- Chặn user tự sửa gói VIP của mình qua API thường (chỉ service role key mới sửa được, dùng trong
-- scripts/xac-nhan-thanh-toan.mjs) — chính sách update sẵn có của nguoi_dung cho phép user sửa hồ
-- sơ của chính mình, nếu không có trigger này họ có thể tự set goi_het_han bất kỳ.
create or replace function public.chan_tu_sua_goi_vip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.goi_loai := old.goi_loai;
    new.goi_het_han := old.goi_het_han;
  end if;
  return new;
end;
$$;

drop trigger if exists truoc_khi_sua_nguoi_dung on public.nguoi_dung;
create trigger truoc_khi_sua_nguoi_dung
  before update on public.nguoi_dung
  for each row execute function public.chan_tu_sua_goi_vip();

create table if not exists giao_dich (
  id uuid primary key default gen_random_uuid(),
  nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
  ma_giao_dich text not null unique,
  goi_loai text not null,
  so_tien integer not null,
  trang_thai text not null default 'cho_thanh_toan',
  tao_luc timestamptz not null default now(),
  thanh_toan_luc timestamptz
);

alter table giao_dich enable row level security;

drop policy if exists "user xem giao dich cua minh" on giao_dich;
create policy "user xem giao dich cua minh" on giao_dich
  for select using (auth.uid() = nguoi_dung_id);

drop policy if exists "user tao giao dich cho minh" on giao_dich;
create policy "user tao giao dich cho minh" on giao_dich
  for insert with check (auth.uid() = nguoi_dung_id and trang_thai = 'cho_thanh_toan');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: thêm schema DB cho gói VIP (cột nguoi_dung, bảng giao_dich, trigger chặn tự sửa)"
```

Ghi chú cho người thực thi: user (chủ site) sẽ tự chạy đoạn SQL này qua Supabase Dashboard sau khi
plan hoàn tất — không cần chạy thay, chỉ cần code đúng.

---

### Task 2: Cấu hình gói VIP + hàm thuần tính hạn/mã giao dịch

**Files:**
- Create: `lib/config/goi-vip.ts`
- Create: `lib/utils/gia-han-vip.ts`
- Test: `lib/utils/gia-han-vip.test.ts`

**Interfaces:**
- Produces: `DANH_SACH_GOI: ThongTinGoi[]`, `layThongTinGoi(ma: string): ThongTinGoi | null`,
  `SO_CHUONG_FREE: number` (từ `lib/config/goi-vip.ts`); `tinhHanMoi(soNgay: number, tuLuc?: Date):
  Date`, `conHieuLucGoi(goiHetHan: string | null, hienTai?: Date): boolean`,
  `sinhMaGiaoDich(): string` (từ `lib/utils/gia-han-vip.ts`).

- [ ] **Step 1: Viết `lib/config/goi-vip.ts`**

```ts
export type MaGoi = 'so_cap' | 'trung_cap' | 'cao_cap';

export type ThongTinGoi = {
  ma: MaGoi;
  ten: string;
  soNgay: number;
  gia: number;
};

export const SO_CHUONG_FREE = 50;

export const DANH_SACH_GOI: ThongTinGoi[] = [
  { ma: 'so_cap', ten: 'Gói ngày', soNgay: 1, gia: 6000 },
  { ma: 'trung_cap', ten: 'Gói tuần', soNgay: 7, gia: 39000 },
  { ma: 'cao_cap', ten: 'Gói tháng', soNgay: 30, gia: 162000 },
];

export function layThongTinGoi(ma: string): ThongTinGoi | null {
  return DANH_SACH_GOI.find((g) => g.ma === ma) ?? null;
}
```

- [ ] **Step 2: Viết test trước — `lib/utils/gia-han-vip.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tinhHanMoi, conHieuLucGoi, sinhMaGiaoDich } from './gia-han-vip';

describe('tinhHanMoi', () => {
  it('cong dung so ngay vao thoi diem cho truoc', () => {
    const tuLuc = new Date('2026-09-13T10:00:00.000Z');
    expect(tinhHanMoi(7, tuLuc).toISOString()).toBe('2026-09-20T10:00:00.000Z');
  });

  it('mac dinh tinh tu thoi diem hien tai neu khong truyen tuLuc', () => {
    const truoc = Date.now();
    const ketQua = tinhHanMoi(1);
    const sau = Date.now();
    const mot_ngay = 24 * 60 * 60 * 1000;
    expect(ketQua.getTime()).toBeGreaterThanOrEqual(truoc + mot_ngay);
    expect(ketQua.getTime()).toBeLessThanOrEqual(sau + mot_ngay);
  });
});

describe('conHieuLucGoi', () => {
  it('tra ve false neu chua co goi (null)', () => {
    expect(conHieuLucGoi(null)).toBe(false);
  });

  it('tra ve false neu da het han', () => {
    const hienTai = new Date('2026-09-13T10:00:00.000Z');
    expect(conHieuLucGoi('2026-09-12T10:00:00.000Z', hienTai)).toBe(false);
  });

  it('tra ve true neu con hieu luc', () => {
    const hienTai = new Date('2026-09-13T10:00:00.000Z');
    expect(conHieuLucGoi('2026-09-14T10:00:00.000Z', hienTai)).toBe(true);
  });
});

describe('sinhMaGiaoDich', () => {
  it('sinh dung dinh dang VIP-XXXXXX', () => {
    expect(sinhMaGiaoDich()).toMatch(/^VIP-[A-Z0-9]{6}$/);
  });

  it('sinh 2 lan cho ra 2 ma khac nhau (xac suat trung cuc thap)', () => {
    expect(sinhMaGiaoDich()).not.toBe(sinhMaGiaoDich());
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL (chưa có file `gia-han-vip.ts`)**

Run: `npx vitest run lib/utils/gia-han-vip.test.ts`
Expected: FAIL với lỗi không tìm thấy module `./gia-han-vip`

- [ ] **Step 4: Viết `lib/utils/gia-han-vip.ts`**

```ts
export function tinhHanMoi(soNgay: number, tuLuc: Date = new Date()): Date {
  return new Date(tuLuc.getTime() + soNgay * 24 * 60 * 60 * 1000);
}

export function conHieuLucGoi(goiHetHan: string | null, hienTai: Date = new Date()): boolean {
  if (!goiHetHan) return false;
  return new Date(goiHetHan).getTime() > hienTai.getTime();
}

const KY_TU_MA_GIAO_DICH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function sinhMaGiaoDich(): string {
  let ma = '';
  for (let i = 0; i < 6; i += 1) {
    ma += KY_TU_MA_GIAO_DICH[Math.floor(Math.random() * KY_TU_MA_GIAO_DICH.length)];
  }
  return `VIP-${ma}`;
}
```

- [ ] **Step 5: Chạy lại test, xác nhận PASS**

Run: `npx vitest run lib/utils/gia-han-vip.test.ts`
Expected: PASS toàn bộ 6 test

- [ ] **Step 6: Commit**

```bash
git add lib/config/goi-vip.ts lib/utils/gia-han-vip.ts lib/utils/gia-han-vip.test.ts
git commit -m "feat: thêm cấu hình 3 gói VIP + hàm thuần tính hạn/mã giao dịch"
```

---

### Task 3: Server action tạo giao dịch

**Files:**
- Create: `app/tai-khoan/actions-goi-vip.ts`

**Interfaces:**
- Consumes: `layThongTinGoi(ma): ThongTinGoi | null`, `sinhMaGiaoDich(): string` (Task 2);
  `taoSupabaseServerClient()` (`lib/supabase/server.ts`, đã có sẵn).
- Produces: `taoGiaoDich(goiMa: string): Promise<KetQuaTaoGiaoDich>` với
  `KetQuaTaoGiaoDich = { thanhCong: true; maGiaoDich: string; soTien: number; tenGoi: string } |
  { thanhCong: false; loi: string }` — dùng ở Task 4.

- [ ] **Step 1: Viết `app/tai-khoan/actions-goi-vip.ts`**

```ts
'use server';

import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { layThongTinGoi } from '@/lib/config/goi-vip';
import { sinhMaGiaoDich } from '@/lib/utils/gia-han-vip';

export type KetQuaTaoGiaoDich =
  | { thanhCong: true; maGiaoDich: string; soTien: number; tenGoi: string }
  | { thanhCong: false; loi: string };

export async function taoGiaoDich(goiMa: string): Promise<KetQuaTaoGiaoDich> {
  const thongTinGoi = layThongTinGoi(goiMa);
  if (!thongTinGoi) return { thanhCong: false, loi: 'Gói không hợp lệ.' };

  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { thanhCong: false, loi: 'Bạn cần đăng nhập để mua gói.' };

  const SO_LAN_THU_TOI_DA = 3;
  for (let lanThu = 0; lanThu < SO_LAN_THU_TOI_DA; lanThu += 1) {
    const maGiaoDich = sinhMaGiaoDich();
    const { error } = await supabase.from('giao_dich').insert({
      nguoi_dung_id: user.id,
      ma_giao_dich: maGiaoDich,
      goi_loai: thongTinGoi.ma,
      so_tien: thongTinGoi.gia,
    });
    if (!error) {
      return {
        thanhCong: true,
        maGiaoDich,
        soTien: thongTinGoi.gia,
        tenGoi: thongTinGoi.ten,
      };
    }
    if (error.code !== '23505') {
      return { thanhCong: false, loi: 'Không tạo được giao dịch, thử lại sau.' };
    }
    // 23505 = trùng ma_giao_dich (hiếm gặp) — vòng lặp sẽ sinh mã khác và thử lại.
  }
  return { thanhCong: false, loi: 'Không tạo được giao dịch, thử lại sau.' };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tai-khoan/actions-goi-vip.ts
git commit -m "feat: thêm server action taoGiaoDich cho gói VIP"
```

---

### Task 4: Component chọn gói + hướng dẫn thanh toán

**Files:**
- Create: `components/ChonGoiVip.tsx`

**Interfaces:**
- Consumes: `DANH_SACH_GOI`, `MaGoi` (Task 2); `taoGiaoDich`, `KetQuaTaoGiaoDich` (Task 3).
- Produces: `<ChonGoiVip />` — component không nhận props, tự quản lý state, dùng lại ở Task 5
  (trang Tài khoản) và Task 6 (trang chặn chương).

- [ ] **Step 1: Viết `components/ChonGoiVip.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DANH_SACH_GOI, type MaGoi } from '@/lib/config/goi-vip';
import { taoGiaoDich } from '@/app/tai-khoan/actions-goi-vip';

type TrangThaiModal =
  | { buoc: 'chon-goi' }
  | { buoc: 'huong-dan'; maGiaoDich: string; soTien: number; tenGoi: string }
  | { buoc: 'loi'; thongBao: string };

export default function ChonGoiVip() {
  const [moModal, setMoModal] = useState(false);
  const [trangThai, setTrangThai] = useState<TrangThaiModal>({ buoc: 'chon-goi' });
  const [dangXuLy, setDangXuLy] = useState(false);

  function moLai() {
    setTrangThai({ buoc: 'chon-goi' });
    setMoModal(true);
  }

  async function chonGoi(ma: MaGoi) {
    if (dangXuLy) return;
    setDangXuLy(true);
    const ketQua = await taoGiaoDich(ma);
    if (ketQua.thanhCong) {
      setTrangThai({
        buoc: 'huong-dan',
        maGiaoDich: ketQua.maGiaoDich,
        soTien: ketQua.soTien,
        tenGoi: ketQua.tenGoi,
      });
    } else {
      setTrangThai({ buoc: 'loi', thongBao: ketQua.loi });
    }
    setDangXuLy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={moLai}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
      >
        Mua gói VIP
      </button>
      {moModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-lg p-4 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            {trangThai.buoc === 'chon-goi' && (
              <>
                <h2 className="text-lg font-semibold">Chọn gói VIP</h2>
                <p className="text-xs text-muted-foreground">
                  Mở đọc không giới hạn chương ở mọi truyện trong thời gian gói hiệu lực.
                </p>
                <div className="space-y-2">
                  {DANH_SACH_GOI.map((goi) => (
                    <button
                      key={goi.ma}
                      type="button"
                      disabled={dangXuLy}
                      onClick={() => chonGoi(goi.ma)}
                      className="w-full flex justify-between items-center border border-border rounded p-3 hover:bg-black/5 disabled:opacity-60"
                    >
                      <span>
                        {goi.ten} ({goi.soNgay} ngày)
                      </span>
                      <span className="font-semibold">{goi.gia.toLocaleString('vi-VN')}đ</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {trangThai.buoc === 'huong-dan' && (
              <>
                <h2 className="text-lg font-semibold">Chuyển khoản để kích hoạt</h2>
                <p className="text-sm">
                  Gói: <strong>{trangThai.tenGoi}</strong> — Số tiền:{' '}
                  <strong>{trangThai.soTien.toLocaleString('vi-VN')}đ</strong>
                </p>
                <div className="relative w-full aspect-square bg-surface rounded overflow-hidden">
                  <Image
                    src="/qr-nhan-tien-momo.png"
                    alt="QR nhận tiền MoMo"
                    fill
                    sizes="320px"
                    className="object-contain"
                  />
                </div>
                <p className="text-sm">
                  Chuyển khoản đúng số tiền, nội dung ghi chính xác:{' '}
                  <strong className="text-blue-600">{trangThai.maGiaoDich}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sau khi chuyển khoản, gói sẽ được kích hoạt trong ít phút. Bạn có thể đóng cửa sổ
                  này và quay lại sau.
                </p>
              </>
            )}
            {trangThai.buoc === 'loi' && <p className="text-sm text-red-600">{trangThai.thongBao}</p>}
            <button
              type="button"
              onClick={() => setMoModal(false)}
              className="w-full px-4 py-2 rounded border border-border text-sm font-medium"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Đặt ảnh QR nhận tiền (việc thủ công, không phải code)**

Trước khi kiểm chứng thật ở Task 9, cần đặt ảnh QR nhận tiền MoMo cá nhân tại
`public/qr-nhan-tien-momo.png` (vuông, rõ nét) — người dùng tự cung cấp file này, không phải bước
code.

- [ ] **Step 3: Commit**

```bash
git add components/ChonGoiVip.tsx
git commit -m "feat: thêm component ChonGoiVip (modal chọn gói + hướng dẫn chuyển khoản)"
```

---

### Task 5: Trang Tài khoản — mục "Gói VIP"

**Files:**
- Modify: `app/tai-khoan/page.tsx`

**Interfaces:**
- Consumes: `conHieuLucGoi` (Task 2), `<ChonGoiVip />` (Task 4).

- [ ] **Step 1: Sửa `app/tai-khoan/page.tsx` — thêm fetch trạng thái gói + mục "Gói VIP"**

Thay toàn bộ nội dung file bằng:

```tsx
import Link from 'next/link';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import NutDangXuat from '@/components/NutDangXuat';
import ChonTheme from '@/components/ChonTheme';
import ChonGoiVip from '@/components/ChonGoiVip';

export default async function TrangTaiKhoan() {
  const supabase = await taoSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tenNguoiDung: string | null = null;
  let goiHetHan: string | null = null;
  if (user) {
    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('ten_nguoi_dung, goi_het_han')
      .eq('id', user.id)
      .maybeSingle();
    tenNguoiDung = hoSo?.ten_nguoi_dung ?? null;
    goiHetHan = hoSo?.goi_het_han ?? null;
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

      {user && (
        <section className="border border-border bg-surface rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Gói VIP</h2>
          {conHieuLucGoi(goiHetHan) ? (
            <p className="text-sm">
              Đang có gói VIP, hiệu lực đến{' '}
              <strong>
                {new Date(goiHetHan as string).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </strong>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có gói VIP đang hiệu lực.</p>
          )}
          <ChonGoiVip />
        </section>
      )}

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

- [ ] **Step 2: Chạy build để bắt lỗi type sớm**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript/ESLint liên quan file vừa sửa

- [ ] **Step 3: Commit**

```bash
git add app/tai-khoan/page.tsx
git commit -m "feat: thêm mục Gói VIP vào trang Tài khoản"
```

---

### Task 6: Gate chương >50 theo gói VIP

**Files:**
- Create: `app/truyen/[slug]/chuong/[so]/ChanChuongVip.tsx`
- Modify: `app/truyen/[slug]/chuong/[so]/page.tsx`

**Interfaces:**
- Consumes: `SO_CHUONG_FREE` (Task 2 config), `conHieuLucGoi` (Task 2), `<ChonGoiVip />` (Task 4).

- [ ] **Step 1: Viết `app/truyen/[slug]/chuong/[so]/ChanChuongVip.tsx`**

```tsx
import Link from 'next/link';
import ChonGoiVip from '@/components/ChonGoiVip';

export default function ChanChuongVip({
  tenTruyen,
  slugTruyen,
  soChuong,
}: {
  tenTruyen: string;
  slugTruyen: string;
  soChuong: number;
}) {
  return (
    <main className="w-full max-w-xl mx-auto p-6 text-center space-y-4">
      <h1 className="text-xl font-bold">Chương {soChuong} cần gói VIP</h1>
      <p className="text-muted-foreground">
        {tenTruyen} — 50 chương đầu đọc miễn phí, từ chương 51 trở đi cần có gói VIP đang hiệu lực để
        đọc.
      </p>
      <div className="flex justify-center">
        <ChonGoiVip />
      </div>
      <Link
        href={`/truyen/${slugTruyen}`}
        className="inline-block text-sm underline text-muted-foreground"
      >
        Quay lại trang truyện
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Sửa `app/truyen/[slug]/chuong/[so]/page.tsx` — hoist `getUser()` + thêm gate**

Thay toàn bộ nội dung file bằng:

```tsx
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { taoSupabaseServerClient } from '@/lib/supabase/server';
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
import LuuTienDo from './LuuTienDo';
import KhungDocChuong from './KhungDocChuong';
import ChanChuongVip from './ChanChuongVip';

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (chuong.so_chuong > SO_CHUONG_FREE) {
    if (!user) redirect('/dang-nhap');

    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('goi_het_han')
      .eq('id', user.id)
      .maybeSingle();

    if (!conHieuLucGoi(hoSo?.goi_het_han ?? null)) {
      return <ChanChuongVip tenTruyen={truyen.ten} slugTruyen={slug} soChuong={chuong.so_chuong} />;
    }
  }

  // Ghi nhận lượt xem (chống trùng vĩnh viễn, không chặn render nội dung)
  try {
    const cookieStore = await cookies();
    const khachId = cookieStore.get('khach_id')?.value;

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

  const { data: dsChuong } = await supabase
    .from('chuong')
    .select('so_chuong, tieu_de')
    .eq('truyen_id', truyen.id)
    .order('so_chuong', { ascending: true });

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
        dsChuong={(dsChuong ?? []).map((c) => ({ soChuong: c.so_chuong, tieuDe: c.tieu_de }))}
      />
    </>
  );
}
```

- [ ] **Step 3: Chạy build**

Run: `npm run build`
Expected: build thành công

- [ ] **Step 4: Commit**

```bash
git add app/truyen/[slug]/chuong/[so]/page.tsx app/truyen/[slug]/chuong/[so]/ChanChuongVip.tsx
git commit -m "feat: gate chương >50 theo gói VIP, redirect đăng nhập nếu chưa có tài khoản"
```

---

### Task 7: Icon khoá cho chương >50 trong danh sách chương trên trang truyện

**Files:**
- Modify: `app/truyen/[slug]/page.tsx`

**Interfaces:**
- Consumes: `SO_CHUONG_FREE` (Task 2), `conHieuLucGoi` (Task 2).

- [ ] **Step 1: Sửa `app/truyen/[slug]/page.tsx`**

Thêm import ở đầu file (sau các import hiện có):

```tsx
import { SO_CHUONG_FREE } from '@/lib/config/goi-vip';
import { conHieuLucGoi } from '@/lib/utils/gia-han-vip';
```

Thêm đoạn fetch trạng thái gói, ngay sau khối `daLuuBanDau` hiện có (sau dòng
`daLuuBanDau = !!daLuu;` và trước `return (`):

```tsx
  let coGoiHieuLuc = false;
  if (user) {
    const { data: hoSo } = await supabase
      .from('nguoi_dung')
      .select('goi_het_han')
      .eq('id', user.id)
      .maybeSingle();
    coGoiHieuLuc = conHieuLucGoi(hoSo?.goi_het_han ?? null);
  }
```

Thay khối `<ul>` danh sách chương hiện có:

```tsx
      <ul className="mt-6 space-y-1">
        {(dsChuong ?? []).map((chuong) => (
          <li key={chuong.id}>
            <Link href={`/truyen/${slug}/chuong/${chuong.so_chuong}`} className="hover:underline">
              Chương {chuong.so_chuong}: {chuong.tieu_de}
            </Link>
          </li>
        ))}
      </ul>
```

bằng:

```tsx
      <ul className="mt-6 space-y-1">
        {(dsChuong ?? []).map((chuong) => {
          const bLKhoa = chuong.so_chuong > SO_CHUONG_FREE && !coGoiHieuLuc;
          return (
            <li key={chuong.id}>
              <Link
                href={`/truyen/${slug}/chuong/${chuong.so_chuong}`}
                className="flex items-center gap-1.5 hover:underline"
              >
                {bLKhoa && (
                  <svg
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
                    />
                  </svg>
                )}
                Chương {chuong.so_chuong}: {chuong.tieu_de}
              </Link>
            </li>
          );
        })}
      </ul>
```

- [ ] **Step 2: Chạy build**

Run: `npm run build`
Expected: build thành công

- [ ] **Step 3: Commit**

```bash
git add app/truyen/[slug]/page.tsx
git commit -m "feat: hiện icon khoá cho chương >50 khi chưa có gói VIP"
```

---

### Task 8: Script CLI xác nhận thanh toán

**Files:**
- Create: `scripts/xac-nhan-thanh-toan-logic.js`
- Test: `scripts/xac-nhan-thanh-toan-logic.test.js`
- Create: `scripts/xac-nhan-thanh-toan.mjs`

**Interfaces:**
- Produces: `tinhHanMoi(soNgay: number, tuLuc?: Date): Date`, `SO_NGAY_THEO_GOI: Record<string,
  number>`, `TEN_GOI: Record<string, string>` (từ `scripts/xac-nhan-thanh-toan-logic.js`); CLI
  `node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <MA_GIAO_DICH>`.

- [ ] **Step 1: Viết test trước — `scripts/xac-nhan-thanh-toan-logic.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { tinhHanMoi, SO_NGAY_THEO_GOI, TEN_GOI } from './xac-nhan-thanh-toan-logic.js';

describe('tinhHanMoi', () => {
  it('cong dung so ngay vao thoi diem cho truoc', () => {
    const tuLuc = new Date('2026-09-13T10:00:00.000Z');
    expect(tinhHanMoi(30, tuLuc).toISOString()).toBe('2026-10-13T10:00:00.000Z');
  });
});

describe('SO_NGAY_THEO_GOI', () => {
  it('co dung so ngay cho ca 3 goi', () => {
    expect(SO_NGAY_THEO_GOI.so_cap).toBe(1);
    expect(SO_NGAY_THEO_GOI.trung_cap).toBe(7);
    expect(SO_NGAY_THEO_GOI.cao_cap).toBe(30);
  });
});

describe('TEN_GOI', () => {
  it('co ten hien thi cho ca 3 goi', () => {
    expect(TEN_GOI.so_cap).toBeTruthy();
    expect(TEN_GOI.trung_cap).toBeTruthy();
    expect(TEN_GOI.cao_cap).toBeTruthy();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run scripts/xac-nhan-thanh-toan-logic.test.js`
Expected: FAIL với lỗi không tìm thấy module `./xac-nhan-thanh-toan-logic.js`

- [ ] **Step 3: Viết `scripts/xac-nhan-thanh-toan-logic.js`**

```js
export const SO_NGAY_THEO_GOI = {
  so_cap: 1,
  trung_cap: 7,
  cao_cap: 30,
};

export const TEN_GOI = {
  so_cap: 'Gói ngày',
  trung_cap: 'Gói tuần',
  cao_cap: 'Gói tháng',
};

export function tinhHanMoi(soNgay, tuLuc = new Date()) {
  return new Date(tuLuc.getTime() + soNgay * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run scripts/xac-nhan-thanh-toan-logic.test.js`
Expected: PASS toàn bộ 3 test

- [ ] **Step 5: Viết `scripts/xac-nhan-thanh-toan.mjs`**

```js
#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { tinhHanMoi, SO_NGAY_THEO_GOI, TEN_GOI } from './xac-nhan-thanh-toan-logic.js';

async function main() {
  const maGiaoDich = process.argv[2];
  if (!maGiaoDich) {
    console.error(
      'Thieu ma giao dich. Cach dung: node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <MA_GIAO_DICH>'
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thieu bien moi truong NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: giaoDich, error: loiTimGiaoDich } = await supabase
    .from('giao_dich')
    .select('id, nguoi_dung_id, goi_loai, so_tien, trang_thai')
    .eq('ma_giao_dich', maGiaoDich)
    .maybeSingle();

  if (loiTimGiaoDich) {
    console.error('Loi truy van giao dich:', loiTimGiaoDich.message);
    process.exit(1);
  }
  if (!giaoDich) {
    console.error(`Khong tim thay giao dich voi ma "${maGiaoDich}".`);
    process.exit(1);
  }
  if (giaoDich.trang_thai === 'da_thanh_toan') {
    console.warn(`Giao dich "${maGiaoDich}" da duoc xu ly truoc do. Khong lam gi them.`);
    process.exit(0);
  }

  const soNgay = SO_NGAY_THEO_GOI[giaoDich.goi_loai];
  if (!soNgay) {
    console.error(`Goi khong hop le trong giao dich: "${giaoDich.goi_loai}".`);
    process.exit(1);
  }

  const hanMoi = tinhHanMoi(soNgay);

  const { error: loiUpdateGiaoDich } = await supabase
    .from('giao_dich')
    .update({ trang_thai: 'da_thanh_toan', thanh_toan_luc: new Date().toISOString() })
    .eq('id', giaoDich.id);
  if (loiUpdateGiaoDich) {
    console.error('Loi cap nhat giao dich:', loiUpdateGiaoDich.message);
    process.exit(1);
  }

  const { data: nguoiDung, error: loiUpdateNguoiDung } = await supabase
    .from('nguoi_dung')
    .update({ goi_loai: giaoDich.goi_loai, goi_het_han: hanMoi.toISOString() })
    .eq('id', giaoDich.nguoi_dung_id)
    .select('ten_nguoi_dung')
    .maybeSingle();
  if (loiUpdateNguoiDung) {
    console.error('Loi nang cap tai khoan:', loiUpdateNguoiDung.message);
    process.exit(1);
  }

  console.log('Da nang cap thanh cong.');
  console.log(`Nguoi dung: ${nguoiDung?.ten_nguoi_dung ?? giaoDich.nguoi_dung_id}`);
  console.log(`Goi: ${TEN_GOI[giaoDich.goi_loai]}`);
  console.log(`Het han moi: ${hanMoi.toLocaleString('vi-VN')}`);
}

main();
```

- [ ] **Step 6: Commit**

```bash
git add scripts/xac-nhan-thanh-toan-logic.js scripts/xac-nhan-thanh-toan-logic.test.js scripts/xac-nhan-thanh-toan.mjs
git commit -m "feat: thêm script CLI xác nhận thanh toán + nâng cấp gói VIP thủ công"
```

---

### Task 9: Kiểm chứng tổng thể + cập nhật tài liệu

**Files:**
- Modify: `NEXT_SESSION.md`, `PROJECT_MAP.md`, `CLAUDE.md`

**Interfaces:**
- Không có interface mới — task tổng hợp, kiểm tra toàn bộ Task 1-8 hoạt động đúng với nhau.

- [ ] **Step 1: Chạy toàn bộ test suite**

Run: `npx vitest run`
Expected: PASS toàn bộ (bao gồm các test cũ + test mới của Task 2 và Task 8)

- [ ] **Step 2: Chạy build**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript/ESLint

- [ ] **Step 3: Kiểm chứng qua browser (Claude tự làm với phiên đăng nhập user đã tự đăng nhập sẵn,
      KHÔNG tự đăng nhập tài khoản thật)**

Sau khi user tự áp dụng SQL Task 1 qua Supabase Dashboard và đặt ảnh QR ở `public/qr-nhan-tien-momo.png`:
- Đọc chương ≤50 khi chưa có gói: đọc bình thường, không bị chặn.
- Đọc chương >50 khi chưa đăng nhập: redirect đúng `/dang-nhap`.
- Đọc chương >50 khi đã đăng nhập nhưng chưa có gói: hiện `ChanChuongVip`, không lộ `noi_dung` trong
  HTML (kiểm tra qua `read_page`/view-source).
- Trang truyện: chương >50 hiện đúng icon khoá khi chưa có gói.
- Trang Tài khoản: mục "Gói VIP" hiện đúng "Chưa có gói VIP đang hiệu lực".
- Bấm "Mua gói VIP" → chọn 1 gói → modal hiện đúng mã `VIP-XXXXXX` + số tiền + ảnh QR.
- Nhờ user tự chạy `node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <mã vừa tạo>` (Claude
  không tự chạy thay — đây là hành động "nâng cấp tài khoản thật", chỉ chạy khi user xác nhận đã tự
  kiểm tra tiền và yêu cầu rõ ràng) → script in đúng tên gói + hạn mới.
- F5 lại trang Tài khoản/trang chương >50: thấy gói đã kích hoạt, đọc được chương >50, icon khoá biến
  mất trên trang truyện.
- Chạy lại script với cùng mã giao dịch lần 2: in cảnh báo "đã xử lý trước đó", không nâng hạn thêm
  lần nữa.

- [ ] **Step 4: Cập nhật `NEXT_SESSION.md`**

Thêm mục mới ở đầu file (trước mục hiện tại), tóm tắt: đã hoàn thành hệ thống gói VIP bản thủ công
(3 gói, gate chương >50, script xác nhận thanh toán), PayOS/webhook tự động **hoãn sang phiên sau**
(user chưa có tài khoản PayOS), vẫn còn 3 việc bảo mật tồn đọng từ phiên trước.

- [ ] **Step 5: Cập nhật `PROJECT_MAP.md`**

Thêm các file mới của Task 1-8 vào đúng vị trí trong cây thư mục (`lib/config/goi-vip.ts`,
`lib/utils/gia-han-vip.ts`, `app/tai-khoan/actions-goi-vip.ts`, `components/ChonGoiVip.tsx`,
`app/truyen/[slug]/chuong/[so]/ChanChuongVip.tsx`, `scripts/xac-nhan-thanh-toan-logic.js`,
`scripts/xac-nhan-thanh-toan.mjs`), thêm cột `goi_loai`/`goi_het_han` và bảng `giao_dich` vào mục
"Data model".

- [ ] **Step 6: Cập nhật `CLAUDE.md`**

Sửa mục "Kế hoạch tiếp theo — Hệ thống trả phí / tài khoản VIP" thành trạng thái đã triển khai bản
thủ công v1, ghi rõ PayOS/webhook tự động là việc còn lại tiếp theo.

- [ ] **Step 7: Commit**

```bash
git add NEXT_SESSION.md PROJECT_MAP.md CLAUDE.md
git commit -m "docs: cập nhật trạng thái hệ thống gói VIP thủ công v1, ghi chú PayOS hoãn sang phiên sau"
```
