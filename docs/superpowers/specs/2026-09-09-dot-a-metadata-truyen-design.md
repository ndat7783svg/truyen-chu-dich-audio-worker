# Thiết kế: Đợt A — Ảnh bìa, tác giả, thể loại, trang chủ/trang truyện nâng cấp

Ngày: 2026-09-09

## Bối cảnh & mục đích
Website hiện tại (v1) đã có trang chủ/trang truyện/trang đọc chương nhưng còn sơ sài so với các
trang đọc truyện tham khảo (vd `truyendich.store`): thiếu ảnh bìa, tác giả, thể loại; mô tả truyện
phải nhập tay qua chat. Đợt A bổ sung các trường metadata này bằng cách đọc trực tiếp dữ liệu đã có
sẵn bên `D:\translate truyen` (nguồn gốc duy nhất, dự án này chỉ đọc), và nâng cấp UI trang chủ +
trang truyện để hiển thị đầy đủ.

Đợt B (lượt xem, đánh giá sao, "Top thịnh hành", sidebar "Đọc tiếp") bàn & thiết kế sau, không nằm
trong phạm vi bản này.

## Nguồn dữ liệu (đã xác nhận có thật trong `D:\translate truyen`)
```
danh-sach-truyen/[Tên truyện]/thong-tin/
├── anh-bia.jpg
└── thong-tin.md
```
`thong-tin.md` có cấu trúc (ví dụ thật, dự án dịch tự quy định — dự án này KHÔNG sửa quy tắc đó):
- Dòng `**Tác giả gốc:** ...`
- Dòng `**Thể loại:** A / B / C (mô tả bối cảnh, nhân vật... trong ngoặc)`
- Mục markdown `## Giới thiệu` chứa đoạn giới thiệu truyện

Không phải mọi truyện chắc chắn có sẵn thư mục `thong-tin/` này (truyện đang có trên web hiện tại
mới được bổ sung gần đây) — cần fallback.

## Data model (Supabase / Postgres) — thay đổi so với v1

**`truyen`** — thêm cột:
| Cột | Kiểu | Ghi chú |
|---|---|---|
| tac_gia | text, nullable | Lấy từ "Tác giả gốc" trong `thong-tin.md` |

Cột `anh_bia` (đã có, trước đây luôn null) — từ nay lưu public URL ảnh trên Supabase Storage.
Cột `mo_ta` (đã có, trước đây nhập tay) — từ nay lấy từ mục "## Giới thiệu".

**`the_loai`** (mới):
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid, PK | |
| ten | text | Tên hiển thị, vd "Huyền Huyễn" |
| slug | text, unique | Sinh từ `ten` bằng hàm `taoSlug` đã có (Task 3) |

**`truyen_the_loai`** (mới, bảng nối nhiều-nhiều):
| Cột | Kiểu | Ghi chú |
|---|---|---|
| truyen_id | uuid, FK → truyen | |
| the_loai_id | uuid, FK → the_loai | |
| Khoá chính | (truyen_id, the_loai_id) | Chống nối trùng |

RLS: đọc công khai (giống bảng `truyen`/`chuong` hiện tại), ghi chỉ qua service role key (sync
script), không cho client ghi trực tiếp.

## Lưu trữ ảnh bìa (Supabase Storage)
- Bucket công khai mới, tên `anh-bia`.
- Object path: `[slug-truyen].jpg` (dùng slug đã sinh sẵn cho truyện, không dùng tên có dấu/khoảng
  trắng).
- Sync script dùng service role key upload trực tiếp (`upsert: true` — ghi đè nếu ảnh đổi), lấy
  public URL lưu vào `truyen.anh_bia`.

## Parser mới: `scripts/parse-thong-tin.js` (TDD, theo mẫu `parse-chuong.js`)
Input: nội dung text thô của `thong-tin.md`. Output: `{ tacGia, theLoai: string[], moTa }`, field
nào không tìm thấy → `null` (không throw, để sync script tự quyết định fallback).

Quy tắc trích xuất:
- `tacGia`: khớp dòng bắt đầu `**Tác giả gốc:**`, lấy phần còn lại sau dấu `:`, trim.
- `theLoai`: khớp dòng bắt đầu `**Thể loại:**`, lấy phần sau dấu `:`; cắt bỏ mọi nội dung từ dấu
  `(` đầu tiên trở đi (đó là phần mô tả bối cảnh, không phải tên thể loại); tách phần còn lại theo
  `/`; trim từng phần tử, bỏ phần tử rỗng.
- `moTa`: tìm heading `## Giới thiệu`, lấy toàn bộ nội dung phía sau cho đến hết file hoặc đến
  heading `##` tiếp theo (vd tránh dính vào mục khác nếu có sau này); trim khoảng trắng đầu/cuối.

Test cases (TDD):
1. File đúng format thật (dùng bản rút gọn của `thong-tin.md` hiện có làm fixture) → trả đủ 3
   field đúng giá trị.
2. File thiếu dòng `**Thể loại:**` → `theLoai` là mảng rỗng, 2 field kia vẫn lấy được.
3. File thiếu hẳn mục `## Giới thiệu` → `moTa` là `null`.
4. `**Thể loại:**` không có dấu ngoặc mô tả (chỉ liệt kê thuần) → vẫn tách đúng theo `/`.

## Sync script (`scripts/sync-truyen.mjs`) — thay đổi hành vi
Với mỗi lần chạy "check [tên truyện]" (bất kể truyện đã tồn tại trên web hay chưa):

1. Kiểm tra tồn tại `danh-sach-truyen/[Tên truyện]/thong-tin/thong-tin.md` và `anh-bia.jpg`.
2. Nếu **có cả hai**:
   - Parse `thong-tin.md` bằng `parse-thong-tin.js`.
   - Upload `anh-bia.jpg` lên Storage (ghi đè), lấy URL.
   - **Ghi đè** (upsert) `tac_gia`, `mo_ta`, `anh_bia` trên bản ghi `truyen` theo dữ liệu mới nhất
     đọc được — kể cả khi truyện đã tồn tại từ trước (đúng nguyên tắc "D:\translate truyen là nguồn
     gốc duy nhất").
   - Với mỗi tên trong `theLoai`: upsert vào bảng `the_loai` theo `slug` (tạo nếu chưa có), rồi
     insert vào `truyen_the_loai` nếu chưa nối (bỏ qua êm nếu đã nối — coi bảng nối là tập hợp,
     không xoá quan hệ cũ dù `thong-tin.md` bớt thể loại, để tránh mất dữ liệu ngoài ý muốn; chỉ
     thêm mới).
3. Nếu **thiếu thư mục `thong-tin/`** hoàn toàn, hoặc parser trả `null` cho field nào đó: giữ hành
   vi fallback hiện tại cho đúng phần thiếu — hỏi user nhập tay hoặc để trống (không đụng vào giá
   trị đã có sẵn trên web nếu lần này không đọc được).
4. Báo cáo lại cho user: đã cập nhật metadata gì (ảnh bìa/tác giả/thể loại/mô tả), ngoài phần báo
   chương mới như hiện tại.

## Trang & UI

**Component thẻ truyện** (dùng chung ở trang chủ và trang thể loại):
- Ảnh bìa (nếu `anh_bia` null → placeholder tĩnh, không load ảnh vỡ).
- Tên truyện, tác giả (ẩn dòng này nếu `tac_gia` null).
- Badge trạng thái (đang ra / hoàn thành — đã có sẵn `trang_thai`).
- Badge thể loại (hiển thị tối đa 3, phần dư gộp thành "+N").

**`/the-loai/[slug]`** (route mới): tiêu đề = tên thể loại, bên dưới là lưới thẻ truyện thuộc thể
loại đó (query qua bảng nối). Không có truyện nào → thông báo trống, không lỗi.

**Trang chủ (`/`)**:
- Thêm nav "Thể loại" — dropdown liệt kê tất cả thể loại hiện có trong DB, mỗi mục link tới
  `/the-loai/[slug]`.
- Đổi danh sách truyện hiện tại sang dùng component thẻ truyện mới.
- Giữ nguyên ô tìm kiếm theo tên.

**Trang truyện (`/truyen/[slug]`)**:
- Thêm: ảnh bìa lớn ở đầu trang, dòng tác giả (nếu có), badge thể loại (mỗi badge link tới trang
  thể loại tương ứng), mô tả đầy đủ (không cắt ngắn, khác thẻ truyện).
- Giữ nguyên: trạng thái, danh sách chương, nút "Đọc tiếp".

## Xử lý lỗi
- `thong-tin.md` có nhưng `anh-bia.jpg` không tồn tại (hoặc ngược lại) → báo cụ thể file nào thiếu,
  field liên quan để `null`/giữ giá trị cũ, không chặn phần còn lại (chương vẫn sync bình thường).
- Upload lên Supabase Storage lỗi (mất mạng, quyền...) → báo lỗi rõ ràng cho user, dừng bước đó lại
  (không âm thầm bỏ qua, không ghi `anh_bia` sai).
- Parser gặp field không đúng định dạng kỳ vọng → trả `null` cho field đó thay vì throw, để sync
  script tự quyết định fallback (không chặn toàn bộ lần "check").

## Testing
- TDD cho `scripts/parse-thong-tin.js` theo 4 test case ở trên, chạy trước khi viết logic sync
  script dùng nó (đúng thứ tự TDD như Task 3/4 ở v1).
- Test thủ công qua browser (dev server + Supabase thật):
  1. Chạy lại `check` cho truyện đang có sẵn (đã có `thong-tin/thong-tin.md` + `anh-bia.jpg` thật)
     → verify ảnh bìa/tác giả/thể loại hiện đúng trên trang chủ, trang truyện, trang thể loại mới.
  2. Verify trang `/the-loai/[slug]` với thể loại có/không có truyện.
  3. Verify placeholder ảnh bìa không lỗi khi giả lập truyện chưa có `thong-tin/` (nếu còn kịp test
     trước khi mọi truyện đều có đủ metadata).

## Ngoài phạm vi (Đợt B, bàn sau)
- Lượt xem, đánh giá sao.
- Mục "Top thịnh hành", sidebar "Đọc tiếp" (dùng dữ liệu `tien_do_doc` liên truyện).
- Khu vực trang chủ kiểu "Đề cử"/"Mới cập nhật" theo curation hoặc thuật toán.
