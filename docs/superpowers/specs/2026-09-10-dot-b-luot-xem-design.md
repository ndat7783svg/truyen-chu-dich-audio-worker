# Thiết kế: Đợt B (Phần 1) — Lượt xem

Ngày: 2026-09-10

## Bối cảnh & mục đích
Đợt A đã hoàn thành metadata (ảnh bìa, tác giả, thể loại). Đợt B bổ sung các tính năng tương tác:
lượt xem, đánh giá sao, "Top thịnh hành", sidebar "Đọc tiếp" (xem mục "Ngoài phạm vi" của
`docs/superpowers/specs/2026-09-09-dot-a-metadata-truyen-design.md`). Bản thiết kế này chỉ bàn
**lượt xem** — tính năng nền tảng, các tính năng còn lại của Đợt B sẽ brainstorm riêng sau.

Lượt xem giúp độc giả biết truyện/chương nào được đọc nhiều, và là dữ liệu nền cho "Top thịnh hành"
sau này.

## Định nghĩa số liệu (đã bàn với user, chốt rõ để tránh hiểu nhầm)
Mỗi **visitor** (1 user đã đăng nhập, hoặc 1 khách vãng lai được nhận diện qua cookie) chỉ được
tính **1 lượt xem cho 1 chương, duy nhất 1 lần trong suốt vòng đời** — đọc lại chương đó sau này
(dù 1 ngày hay nhiều năm sau) không cộng thêm lượt.

Đây là lựa chọn có chủ đích: số liệu sẽ **nhỏ hơn** nhiều so với các trang đọc truyện tham khảo
(họ thường đếm mỗi lần tải trang, không chống trùng nghiêm ngặt, nên dễ đạt số liệu lớn qua nhiều
năm/nhiều lượt đọc lại/bot quét). Đổi lại, số liệu ở đây phản ánh đúng "số lượt đọc-lần-đầu duy
nhất", trung thực hơn. User đã xác nhận chấp nhận đánh đổi này.

"Lượt xem truyện" = tổng lượt đọc chương cộng dồn của tất cả chương thuộc truyện đó (không đếm
riêng lượt vào trang giới thiệu truyện `/truyen/[slug]`).

## Data model (Supabase / Postgres) — thay đổi so với Đợt A

**`truyen`** — thêm cột:
| Cột | Kiểu | Ghi chú |
|---|---|---|
| luot_xem | integer, not null, default 0 | Tổng lượt đọc chương cộng dồn, cập nhật bởi function `ghi_luot_xem` |

**`chuong`** — thêm cột:
| Cột | Kiểu | Ghi chú |
|---|---|---|
| luot_xem | integer, not null, default 0 | Lượt xem riêng của chương, cập nhật bởi function `ghi_luot_xem` |

**`luot_xem_da_doc`** (mới — bảng dedup, không phải bảng hiển thị):
| Cột | Kiểu | Ghi chú |
|---|---|---|
| visitor_key | text | `nguoidung:<user_id>` nếu đã đăng nhập, `khach:<uuid cookie>` nếu chưa |
| chuong_id | uuid, FK → chuong | |
| tao_luc | timestamptz, default now() | Chỉ để debug, không dùng cho logic |
| Khoá chính | (visitor_key, chuong_id) | Đảm bảo 1 visitor chỉ ghi 1 dòng/chương |

RLS: không cho client đọc/ghi trực tiếp bảng này (chỉ function nội bộ chạy với quyền definer mới
được ghi) — độc giả không cần và không nên đọc được ai đã xem gì.

## Function ghi lượt xem (atomic, chống race condition)
Postgres function `ghi_luot_xem(p_visitor_key text, p_chuong_id uuid, p_truyen_id uuid) returns void`,
chạy với `SECURITY DEFINER`:

```sql
INSERT INTO luot_xem_da_doc (visitor_key, chuong_id) VALUES (p_visitor_key, p_chuong_id)
ON CONFLICT (visitor_key, chuong_id) DO NOTHING;

-- chỉ cộng dồn nếu insert ở trên thực sự tạo dòng mới
IF FOUND THEN
  UPDATE chuong SET luot_xem = luot_xem + 1 WHERE id = p_chuong_id;
  UPDATE truyen SET luot_xem = luot_xem + 1 WHERE id = p_truyen_id;
END IF;
```

Gọi qua `supabase.rpc('ghi_luot_xem', {...})` từ Server Component — không lộ logic dedup ra
client, không có race condition giữa 2 request đồng thời của cùng 1 visitor (nhờ `ON CONFLICT` +
transaction ngầm định của function).

## Định danh visitor

**Đã đăng nhập**: `visitor_key = 'nguoidung:' || auth.uid()` — lấy từ session Supabase Auth hiện có.

**Khách vãng lai**: `visitor_key = 'khach:' || <uuid trong cookie khach_id>`.
- Mở rộng `middleware.ts` (đang refresh session Supabase mỗi request): nếu request chưa có cookie
  `khach_id`, tạo `crypto.randomUUID()`, set cookie `httpOnly`, `path=/`, `maxAge` 2 năm.
- Cookie 2 năm là giới hạn kỹ thuật của trình duyệt/thực tế (xoá cookie, đổi máy → mất định danh,
  bị tính lại từ đầu) — chấp nhận được, không cần giải pháp phức tạp hơn (vd fingerprinting) cho
  quy mô hiện tại.

## Khi nào ghi lượt xem
Tại trang đọc chương `app/truyen/[slug]/chuong/[so]/page.tsx` (Server Component):
1. Sau khi fetch được `chuong` (có `id`, `truyen_id`) như hiện tại.
2. Xác định `visitor_key` (session Supabase hoặc cookie `khach_id`).
3. Gọi `supabase.rpc('ghi_luot_xem', { p_visitor_key, p_chuong_id: chuong.id, p_truyen_id: chuong.truyen_id })`.
4. Bọc try/catch quanh bước 3 — lỗi ghi lượt xem (mất mạng, RPC lỗi...) chỉ log ra console server,
   **không** throw, không chặn render nội dung chương. Đọc truyện là chức năng chính, lượt xem là
   phụ trợ.

Không ghi lượt xem ở trang truyện (`/truyen/[slug]`) hay trang chủ — theo định nghĩa đã chốt,
lượt xem truyện chỉ đến từ lượt đọc chương.

## UI

**Component thẻ truyện (`TheTruyen.tsx`)**: thêm icon mắt + số lượt xem đã rút gọn, đặt cạnh badge
trạng thái/thể loại hiện có.

**Trang truyện (`/truyen/[slug]`)**: hiển thị lượt xem gần tên truyện/tác giả.

**Danh sách chương**: chưa hiển thị lượt xem riêng từng chương ở UI (cột `chuong.luot_xem` vẫn được
ghi nhận đầy đủ trong DB để dùng cho tính năng tương lai, vd "chương hot nhất" hoặc Top thịnh hành
theo chương).

**Hàm định dạng số rút gọn** (dùng chung, đặt tại `lib/dinh-dang-so.ts` hoặc tương tự):
- < 1000 → hiển thị nguyên số (vd `842`)
- 1.000 – 999.999 → chia 1000, 1 chữ số thập phân, hậu tố `K` (vd `12500` → `12.5K`)
- ≥ 1.000.000 → chia 1.000.000, 1 chữ số thập phân, hậu tố `M` (vd `3400000` → `3.4M`)
- Số thập phân `.0` thì bỏ (vd `12000` → `12K`, không phải `12.0K`)

## Xử lý lỗi
- RPC `ghi_luot_xem` lỗi (mất mạng, DB down...) → log lỗi phía server, không chặn render trang đọc
  chương (xem mục "Khi nào ghi lượt xem" bước 4).
- Cookie `khach_id` bị chặn bởi trình duyệt (user tắt cookie) → không tạo được visitor_key ổn định
  cho khách đó; fallback: bỏ qua bước ghi lượt xem cho request đó (không lỗi, không crash) — chấp
  nhận việc khách tắt cookie sẽ không được tính lượt xem.
- 2 request đồng thời cùng 1 visitor đọc cùng 1 chương lần đầu (vd double-click, tab kép) → xử lý
  an toàn nhờ `ON CONFLICT DO NOTHING` trong function, chỉ 1 trong 2 request tăng được counter.

## Testing
- Test thủ công qua browser (dev server + Supabase thật):
  1. Đăng nhập, đọc 1 chương lần đầu → verify `chuong.luot_xem` và `truyen.luot_xem` tăng đúng 1
     trong Supabase Dashboard.
  2. Đọc lại đúng chương đó (refresh nhiều lần) → verify không tăng thêm.
  3. Đọc 1 chương khác cùng truyện → verify `truyen.luot_xem` tăng thêm, `chuong.luot_xem` của
     chương mới cũng tăng đúng.
  4. Mở trình duyệt ẩn danh (chưa đăng nhập) đọc 1 chương → verify cookie `khach_id` được set, lượt
     xem vẫn tăng đúng 1 lần, refresh không tăng thêm.
  5. Verify hiển thị lượt xem đúng định dạng rút gọn trên thẻ truyện (trang chủ) và trang truyện.
- Không cần unit test riêng cho function Postgres (logic đơn giản, kiểm chứng qua test thủ công ở
  trên là đủ cho quy mô dự án). Hàm định dạng số rút gọn (`lib/dinh-dang-so.ts`) nên có unit test
  ngắn (TDD) vì là logic thuần, dễ viết test, dễ sai lệch trường hợp biên (vd đúng 1000, đúng
  1000000, số có `.0`).

## Ngoài phạm vi (Đợt B, các phần còn lại — bàn sau)
- Đánh giá sao.
- "Top thịnh hành" (dùng `truyen.luot_xem` vừa thêm làm 1 tiêu chí, nhưng cần bàn thêm về thời gian
  tính — thịnh hành tuần này khác thịnh hành mọi thời đại).
- Sidebar "Đọc tiếp" (dùng `tien_do_doc` liên truyện, đã có sẵn từ v1).
