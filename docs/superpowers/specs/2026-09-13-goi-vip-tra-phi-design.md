# Thiết kế: Hệ thống trả phí / Gói VIP (bản thủ công v1)

Ngày: 2026-09-13
Trạng thái: đã duyệt qua brainstorming, chờ viết plan implementation.

## Mục tiêu
Mỗi bộ truyện cho đọc free 50 chương đầu, từ chương 51 trở đi phải có gói VIP đang hiệu lực mới đọc
được. Gói VIP tính theo thời gian (không theo từng chương/từng truyện) — kích hoạt gói nào thì mở
toàn bộ mọi truyện không giới hạn chương trong thời gian đó. Lấy cảm hứng từ mô hình "gói 4G" nhà
mạng.

**Quyết định quan trọng nhất phiên này**: ban đầu định dùng cổng PayOS (webhook tự động nâng cấp),
nhưng **tạm hoãn PayOS sang phiên sau** — user chưa có tài khoản PayOS, và số lượng khách hàng hiện
tại còn ít nên chưa cần tự động hoá ngay. **v1 này làm thủ công**: web tạo mã giao dịch, user chuyển
khoản MoMo cá nhân của chủ site kèm mã đó, chủ site tự đối chiếu rồi chạy 1 script CLI để nâng cấp
tài khoản. Thiết kế DB/gating ở dưới cố tình tách riêng khỏi cách xử lý thanh toán, để sau này chuyển
sang PayOS chỉ cần thay bước tạo đơn + xác nhận, không đổi schema hay logic gate chương.

## Phạm vi v1 (làm ngay)
- 3 gói theo thời gian, giá cố định trong code.
- Gate chương >50 theo gói hiện tại của user.
- Tạo mã giao dịch + hướng dẫn chuyển khoản MoMo thủ công.
- Script CLI xác nhận thanh toán + nâng cấp tài khoản.
- Trang "Gói VIP" trong `/tai-khoan` + popup chặn khi đọc chương khoá.

## Hoãn lại (ghi vào NEXT_SESSION.md, làm ở phiên sau)
- Tích hợp PayOS: đăng ký tài khoản PayOS, tạo payment link tự động, webhook xác nhận + tự nâng cấp,
  trang `return` tự poll trạng thái. Sẽ thay thế bước 2-3 của luồng thủ công bên dưới.
- Trang admin xem lịch sử `giao_dich` (nếu cần sau này) — v1 tra trực tiếp qua Supabase Dashboard
  hoặc script là đủ.

## Cấu hình gói
File `lib/config/goi-vip.ts`, đặt cứng trong code (đổi giá = sửa code + deploy, không cần bảng
admin):

```ts
export const DANH_SACH_GOI = [
  { ma: 'so_cap', ten: 'Gói ngày', soNgay: 1, gia: 6000 },
  { ma: 'trung_cap', ten: 'Gói tuần', soNgay: 7, gia: 39000 },
  { ma: 'cao_cap', ten: 'Gói tháng', soNgay: 30, gia: 162000 },
] as const;
```

## Database

### Cột mới trên `nguoi_dung`
```sql
alter table nguoi_dung add column goi_loai text; -- 'so_cap' | 'trung_cap' | 'cao_cap' | null
alter table nguoi_dung add column goi_het_han timestamptz; -- null = chưa từng mua/đã hết hạn
```
Kiểm tra quyền đọc chương >50 chỉ cần 1 điều kiện: `goi_het_han is not null and goi_het_han > now()`.

### Bảng mới `giao_dich`
```sql
create table giao_dich (
  id uuid primary key default gen_random_uuid(),
  nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
  ma_giao_dich text not null unique, -- dạng "VIP-XXXXXX", hiển thị cho user điền nội dung chuyển khoản
  goi_loai text not null,
  so_tien integer not null,
  trang_thai text not null default 'cho_thanh_toan', -- 'cho_thanh_toan' | 'da_thanh_toan'
  tao_luc timestamptz not null default now(),
  thanh_toan_luc timestamptz
);

alter table giao_dich enable row level security;

create policy "user xem giao dich cua minh" on giao_dich
  for select using (auth.uid() = nguoi_dung_id);
```
Không cho insert/update qua policy client — tạo đơn qua server action (dùng service role hoặc
`auth.uid()` khớp sẵn), xác nhận thanh toán chỉ qua script CLI (service role key, chạy ngoài
trình duyệt). User tự áp dụng SQL này qua Supabase Dashboard.

## Luồng thanh toán thủ công (v1)

1. User bấm mua 1 trong 3 gói (từ `/tai-khoan` hoặc popup chặn chương) → server action
   `taoGiaoDich(goiMa)`:
   - Kiểm tra đăng nhập (không tin client).
   - Sinh `ma_giao_dich` ngẫu nhiên dạng `VIP-XXXXXX` (6 ký tự chữ+số viết hoa, đủ tránh trùng ở quy
     mô nhỏ; nếu trùng thì sinh lại — kiểm tra unique constraint).
   - Insert 1 dòng `giao_dich` với `trang_thai = 'cho_thanh_toan'`.
   - Trả về `ma_giao_dich`, `so_tien`, `ten` gói cho client hiển thị.
2. Trang hiện hướng dẫn thanh toán: mã QR MoMo nhận tiền cố định (ảnh QR do chủ site cung cấp, đặt
   trong `public/`), kèm dòng chữ rõ: "Chuyển khoản đúng **{so_tien} đồng**, nội dung ghi chính xác:
   **{ma_giao_dich}**". Có nút "Tôi đã chuyển khoản" chỉ đổi text hiển thị thành "Đang chờ xác
   nhận..." — không có tác dụng kỹ thuật gì khác (không tự nâng cấp, không tự query lại).
3. Chủ site tự kiểm tra MoMo, thấy đúng mã + đúng số tiền → chạy:
   ```bash
   node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs VIP-XXXXXX
   ```
   Script (`scripts/xac-nhan-thanh-toan.mjs`, dùng `SUPABASE_SERVICE_ROLE_KEY`):
   - Tra `giao_dich` theo `ma_giao_dich`. Không tồn tại → in lỗi, dừng.
   - Đã ở `trang_thai = 'da_thanh_toan'` → in cảnh báo "đã xử lý trước đó, không làm gì thêm", dừng
     (an toàn khi lỡ chạy trùng).
   - Đang `cho_thanh_toan` → trong 1 transaction: update `giao_dich.trang_thai = 'da_thanh_toan'`,
     `thanh_toan_luc = now()`; tính `het_han_moi = now() + soNgay` (tra `soNgay` theo `goi_loai` từ
     `lib/config/goi-vip.ts`) rồi update `nguoi_dung.goi_het_han = het_han_moi`,
     `nguoi_dung.goi_loai = goi_loai` (**thay thế** hạn cũ, không cộng dồn — theo quyết định đã chốt).
   - In ra: tên user, gói, hạn mới (giờ + ngày) để chủ site đối chiếu.
4. User tự F5 lại trang để thấy gói kích hoạt — chấp nhận độ trễ thủ công, không có thông báo đẩy
   real-time ở v1.

## Gate chương + giao diện

- **Trang đọc chương** (`app/truyen/[slug]/chuong/[so]/page.tsx`): nếu `so_chuong > 50`:
  - Chưa đăng nhập → redirect `/dang-nhap` (gói VIP gắn với tài khoản `nguoi_dung`, không thể gắn
    với khách ẩn danh vì cookie khách dễ xoá để đọc lậu).
  - Đã đăng nhập nhưng `goi_het_han` null hoặc đã qua hạn → **không fetch/render `noi_dung` chương
    xuống HTML** (tránh lộ qua view-source), thay bằng trang/khối chặn có nút "Mua gói" mở modal
    `ChonGoiVip.tsx`.
- **Trang `/tai-khoan`**: thêm mục "Gói VIP" — hiện trạng thái hiện tại ("Còn hiệu lực đến HH:mm
  dd/MM/yyyy" hoặc "Chưa có gói") + 3 nút mua gói dùng chung modal `ChonGoiVip.tsx`.
- **Danh sách chương trên trang truyện**: chương >50 vẫn hiện trong danh sách (không ẩn, tránh hiểu
  lầm truyện thiếu chương), thêm icon khoá nhỏ nếu user chưa có gói hiệu lực.
- **Hiển thị hạn gói**: luôn theo giờ chính xác (không làm tròn ngày), khớp cách tính hết hạn.

## Edge cases
- **`ma_giao_dich` bị nhập sai/không khớp**: script báo lỗi rõ, không đoán/tự sửa.
- **Chuyển khoản sai số tiền**: v1 không tự động đối chiếu số tiền (chủ site tự nhìn bằng mắt trước
  khi chạy script) — script chỉ tin `ma_giao_dich`, không verify lại `so_tien` qua API ngân hàng nào
  (không có, vì đang thủ công).
- **Đơn hàng bị bỏ dở** (tạo `giao_dich` nhưng không thanh toán): để nguyên trạng thái
  `cho_thanh_toan` mãi, không dọn tự động (rác dữ liệu nhỏ, không ảnh hưởng logic gate).
- **User mua gói mới khi đang có gói còn hạn**: gói mới luôn **thay thế** (ghi đè `goi_het_han`/
  `goi_loai`), không cộng dồn thời gian — theo quyết định của user (tự chịu trách nhiệm nếu mua gói
  ngắn hơn đè lên gói dài đang có).
- **Truyện mới có ít hơn 50 chương**: đọc free toàn bộ, không có chương nào bị khoá cho tới khi
  truyện đủ 50 chương trở lên.

## Không làm trong lần này
- Tích hợp PayOS/webhook tự động (xem mục "Hoãn lại" ở trên).
- Trang admin quản lý giao dịch.
- Đối chiếu số tiền tự động.
- Thông báo real-time khi gói được kích hoạt (email/push).
- Lịch sử mua gói hiển thị cho user (chỉ hiện trạng thái hiện tại, không hiện danh sách giao dịch cũ
  trên UI — dữ liệu vẫn có trong DB nếu cần tra sau).

## Testing
- Test thuần cho logic tính `het_han_moi` (cộng số ngày theo gói) và logic kiểm tra quyền đọc chương
  (`goi_het_han > now()`).
- Test cho script `xac-nhan-thanh-toan.mjs`: mã không tồn tại, mã đã xử lý rồi, mã hợp lệ (nâng cấp
  đúng + ghi đè thay vì cộng dồn).
- Kiểm chứng thật qua browser (Claude tự làm, KHÔNG tự đăng nhập tài khoản thật — theo quy tắc an
  toàn `docs/handoff/an-toan-thao-tac.md`): dùng phiên đăng nhập user đã tự đăng nhập sẵn để thử mua
  gói, thấy đúng mã + hướng dẫn; đọc chương >50 khi chưa có gói bị chặn đúng; sau khi chủ site chạy
  script xác nhận (Claude không tự chạy vì đây là hành động "nâng cấp tài khoản" — cần user tự xác
  nhận đã thật sự nhận được tiền trước khi Claude chạy script theo yêu cầu), F5 lại thấy đọc được
  chương >50.
