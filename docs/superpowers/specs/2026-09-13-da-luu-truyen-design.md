# Thiết kế: Tính năng "Đã lưu" (bookmark truyện)

Ngày: 2026-09-13
Trạng thái: đã duyệt qua brainstorming, chờ viết plan implementation.

## Mục tiêu
Cho user đã đăng nhập lưu lại truyện muốn đọc sau, xem danh sách đã lưu trong tab "Đã lưu" ở
trang Tủ truyện (`/tu-truyen`, hiện đang là placeholder "Sắp ra mắt"). Đây là bước đầu tiên hiện
thực nội dung thật cho trang Tủ truyện, chưa làm 2 tab còn lại (Đã đọc/Đã thêm).

## Phạm vi
- Nút "Lưu truyện" — chỉ đặt trên trang truyện (`app/truyen/[slug]/page.tsx`), không đặt trên thẻ
  truyện ở trang chủ/trang thể loại.
- Chỉ dựng 1 tab "Đã lưu" hoạt động thật trong trang Tủ truyện — chưa dựng khung 3 tab, chưa đụng
  tab "Đã đọc"/"Đã thêm" (để bàn thiết kế riêng sau).

## Database

Bảng mới `truyen_da_luu`, tham chiếu `nguoi_dung(id)` (không dùng `auth.users` trực tiếp — theo
quyết định đã chốt ở Đợt đăng ký/đăng nhập, làm nền tảng cho tính năng nạp tiền/mua chương sau
này):

```sql
create table truyen_da_luu (
  nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
  truyen_id uuid not null references truyen(id) on delete cascade,
  luu_luc timestamptz not null default now(),
  primary key (nguoi_dung_id, truyen_id)
);

alter table truyen_da_luu enable row level security;

create policy "user xem truyen da luu cua minh" on truyen_da_luu
  for select using (auth.uid() = nguoi_dung_id);
create policy "user luu truyen cho minh" on truyen_da_luu
  for insert with check (auth.uid() = nguoi_dung_id);
create policy "user bo luu truyen cua minh" on truyen_da_luu
  for delete using (auth.uid() = nguoi_dung_id);
```

Không cần cột `updated_at`/`id` riêng — PK kép `(nguoi_dung_id, truyen_id)` đã đủ để chặn lưu trùng
1 truyện nhiều lần. User tự áp dụng SQL này qua Supabase Dashboard (theo đúng quy trình các bảng
trước).

## Server Actions

File mới `app/truyen/[slug]/actions-luu.ts` (tách riêng khỏi `actions.ts` hiện có của
`luuTienDoDoc` vì khác chủ đề), theo đúng pattern server action đã dùng:

```ts
'use server';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function luuTruyen(truyenId: string) {
  const supabase = await taoSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { thanhCong: false, canDangNhap: true };

  const { error } = await supabase
    .from('truyen_da_luu')
    .insert({ nguoi_dung_id: user.id, truyen_id: truyenId });
  return { thanhCong: !error, canDangNhap: false };
}

export async function boLuuTruyen(truyenId: string) {
  const supabase = await taoSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { thanhCong: false, canDangNhap: true };

  const { error } = await supabase
    .from('truyen_da_luu')
    .delete()
    .eq('nguoi_dung_id', user.id)
    .eq('truyen_id', truyenId);
  return { thanhCong: !error, canDangNhap: false };
}
```

Cả 2 action đều tự kiểm tra đăng nhập ở server (không tin client) — trả về `canDangNhap: true` nếu
chưa đăng nhập, để client hiện thông báo phù hợp.

## Nút "Lưu truyện" trên trang truyện

Component client mới `app/truyen/[slug]/NutLuuTruyen.tsx`:

- Trang truyện (`page.tsx`, server component) query thêm 1 lần lúc render: nếu có user đăng nhập,
  kiểm tra `truyen_da_luu` đã có dòng `(user.id, truyen.id)` chưa → truyền `daLuuBanDau: boolean`
  làm prop. Nếu chưa đăng nhập, truyền `daLuuBanDau: false`.
- Nút luôn hiển thị cho mọi người (không ẩn khi chưa đăng nhập), đổi trạng thái/icon theo
  `daLuu` (đã lưu / chưa lưu).
- Bấm nút:
  - Đã đăng nhập: gọi `luuTruyen`/`boLuuTruyen` tương ứng, cập nhật UI ngay (optimistic), nếu action
    trả lỗi thì rollback lại trạng thái cũ + hiện thông báo lỗi ngắn.
  - Chưa đăng nhập: **không gọi action** (biết trước từ `daLuuBanDau` + có thể check qua context/
    prop `daDangNhap` truyền từ trang truyện) — hiện ngay thông báo dạng toast/text nhỏ cạnh nút:
    "Đăng nhập để lưu truyện" kèm link `/dang-nhap`. Không đổi trạng thái nút.

## Tab "Đã lưu" trong Tủ truyện

`app/tu-truyen/page.tsx` chuyển thành server component (đang là component tĩnh không fetch gì):

- Lấy user hiện tại qua `taoSupabaseServerClient()`.
- Chưa đăng nhập: hiện thông báo mời đăng nhập (không redirect cứng), ví dụ: "Đăng nhập để xem
  truyện đã lưu" + link `/dang-nhap`.
- Đã đăng nhập: query `truyen_da_luu` join `truyen` (lấy `ten`, `slug`, `anh_bia`) theo
  `nguoi_dung_id = user.id`, sắp `luu_luc desc`.
- Danh sách rỗng (đã đăng nhập nhưng chưa lưu gì): thông báo "Chưa lưu truyện nào".
- Render bằng component mới `app/tu-truyen/DongTruyenDaLuu.tsx` (client, vì có nút bỏ lưu tương
  tác) — mỗi truyện 1 hàng ngang: ảnh bìa nhỏ + tên truyện (link tới `/truyen/[slug]`) + nút "Bỏ
  lưu" ở cuối hàng. Bấm "Bỏ lưu" gọi `boLuuTruyen`, xoá hàng khỏi danh sách ngay (optimistic).

## Không làm trong lần này
- Khung 3 tab (Đã đọc/Đã lưu/Đã thêm) của Tủ truyện — chỉ tab Đã lưu.
- Icon lưu trên thẻ truyện ở trang chủ/trang thể loại.
- Hiển thị số lượt lưu công khai trên trang truyện.

## Testing
- Test thuần cho 2 server action (mock Supabase client) nếu pattern hiện có cho phép — theo cách
  `luuTienDoDoc` đã làm (kiểm tra dự án hiện có test cho action này chưa, nếu có thì viết tương tự).
- Kiểm chứng thật qua browser (Claude tự làm, KHÔNG tự đăng nhập tài khoản thật — theo quy tắc an
  toàn `docs/handoff/an-toan-thao-tac.md`): dùng phiên đăng nhập user đã tự đăng nhập sẵn để bấm lưu/
  bỏ lưu, refresh giữ đúng trạng thái, tab Đã lưu hiển thị đúng danh sách + thứ tự, bỏ lưu từ tab
  Đã lưu xoá đúng hàng. Trường hợp chưa đăng nhập: bấm nút Lưu hiện đúng thông báo mời đăng nhập,
  vào `/tu-truyen` hiện đúng thông báo mời đăng nhập.
