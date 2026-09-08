# Thiết kế: Website đăng tải truyện dịch AI

Ngày: 2026-09-08

## Mục đích
Xây website đọc truyện chữ (bản dịch AI, Trung → Việt), lấy nội dung từ dự án dịch riêng biệt
`D:\translate truyen`. Khi user gõ "check [tên bộ truyện]", Claude kiểm tra chương mới trong dự án
dịch rồi đăng lên đúng bộ truyện trên web.

## Đối tượng dùng & phạm vi
- Công khai cho mọi người đọc, hosting domain free `*.vercel.app`.
- Có đăng ký/đăng nhập (email/mật khẩu qua Supabase Auth).
- Mục trả phí mua chương: **kiến trúc chừa sẵn chỗ, KHÔNG code trong bản này** — bàn & thiết lập ở
  giai đoạn sau.

## Kiến trúc
- **Next.js (App Router)**, deploy trên **Vercel** (free tier, domain `*.vercel.app`).
- **Supabase**: Postgres (dữ liệu truyện/chương/tiến độ đọc) + Auth (đăng ký/đăng nhập).
- Quy tắc code: giao Antigravity qua MCP (skill `delegate-antigravity-sk`), Claude lập
  plan/duyệt/kiểm tra kết quả.

## Data model (Supabase / Postgres)

**`truyen`**
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid, PK | |
| ten | text | Tên hiển thị |
| slug | text, unique | Dùng cho URL, sinh từ `ten` |
| mo_ta | text, nullable | |
| anh_bia | text, nullable | URL ảnh bìa (Supabase Storage hoặc để trống ban đầu) |
| trang_thai | text | `dang-ra` / `hoan-thanh`, mặc định `dang-ra` |
| created_at | timestamptz | |

**`chuong`**
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid, PK | |
| truyen_id | uuid, FK → truyen | |
| so_chuong | int | Khớp số trong tên file `chuong-XXX.md` |
| tieu_de | text | Lấy từ dòng đầu file `.md` |
| noi_dung | text | Toàn bộ nội dung chương (markdown/plain text) |
| created_at | timestamptz | Thời điểm đăng lên web |
| Ràng buộc | unique(truyen_id, so_chuong) | Chống đăng trùng chương |

Chừa sẵn chỗ mở rộng sau (không tạo cột ngay): `is_paid boolean`, `gia numeric`.

**`tien_do_doc`** (lưu tiến độ đọc mỗi user)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| user_id | uuid, FK → auth.users | |
| truyen_id | uuid, FK → truyen | |
| chuong_id | uuid, FK → chuong | Chương đang đọc dở |
| updated_at | timestamptz | |
| Khoá chính | (user_id, truyen_id) | Mỗi user 1 tiến độ / truyện |

Người dùng: dùng thẳng bảng `auth.users` có sẵn của Supabase Auth, không tạo bảng riêng cho v1.

## Các trang / route chính
- `/` — Trang chủ: danh sách truyện (tên, ảnh bìa nếu có, trạng thái), ô tìm kiếm theo tên.
- `/truyen/[slug]` — Trang truyện: mô tả + danh sách chương (số, tiêu đề). Nếu user đã đăng nhập
  và có tiến độ đọc → nút "Đọc tiếp chương X" nổi bật.
- `/truyen/[slug]/chuong/[so]` — Trang đọc chương: hiển thị chữ, nút chương trước/sau. Nếu đã đăng
  nhập → tự lưu tiến độ đọc (ghi `tien_do_doc`) khi mở trang.
- `/dang-ky`, `/dang-nhap` — Đăng ký / đăng nhập qua Supabase Auth.
- Dark mode: toggle lưu `localStorage`, áp dụng `data-theme` trên `<html>` (theo đúng lưu ý kỹ
  thuật đã ghi trong `app-web-sk` — client component tự đọc `localStorage` và chủ động set lại
  thuộc tính trong `useEffect`, không chỉ tin DOM còn giữ nguyên sau hydrate).

## Cơ chế đồng bộ "check [tên truyện]"
Khi user gõ lệnh này trong chat, Claude thực hiện (việc đọc/so sánh Claude tự làm trực tiếp — nhỏ,
rõ ràng; phần ghi nhiều chương vào DB có thể giao Antigravity nếu số lượng lớn):

0. Khớp "[tên truyện]" user gõ với tên folder trong `danh-sach-truyen/` (so khớp gần đúng, không
   cần gõ dấu/hoa thường chính xác tuyệt đối). Nếu khớp nhiều hơn 1 folder hoặc không khớp folder
   nào → hỏi lại user chọn đúng tên, không tự đoán đại.
1. Đọc danh sách file trong
   `D:\translate truyen\danh-sach-truyen\[Tên truyện]\chuong\chuong-XXX.md`.
2. Query bảng `chuong` (lọc theo `truyen_id` tương ứng) lấy `so_chuong` lớn nhất đã có trên web.
3. Nếu truyện chưa từng có trong bảng `truyen` (lần đầu đăng) → hỏi user mô tả + ảnh bìa (có thể bỏ
   trống, thêm sau) trước khi tạo bản ghi `truyen`.
4. Với mỗi file chương mới hơn: đọc dòng đầu làm `tieu_de`, phần còn lại làm `noi_dung`, insert vào
   `chuong` (unique constraint chặn trùng).
5. Báo lại cho user: đã đăng chương nào → chương nào, hay "không có chương mới".

Không đồng bộ chiều ngược lại (web → `D:\translate truyen`) — dự án dịch là nguồn dữ liệu gốc duy
nhất, web chỉ đọc và xuất bản.

## Xử lý lỗi cơ bản
- File chương lỗi định dạng (không có dòng tiêu đề, rỗng...) → báo cho user, bỏ qua file đó, không
  chặn các chương khác.
- Insert trùng `(truyen_id, so_chuong)` → bị unique constraint chặn, coi là đã đăng rồi, bỏ qua êm.
- Mất kết nối Supabase khi đăng → báo lỗi rõ ràng cho user, không âm thầm bỏ qua.

## Testing
- Test thủ công qua trình duyệt (chạy `next dev`, hoặc preview Vercel): tạo truyện mẫu, đăng vài
  chương, kiểm tra đọc/tìm kiếm/dark mode/lưu tiến độ đọc/đăng nhập hoạt động đúng.
- Không cần bộ test tự động phức tạp cho v1 (ưu tiên đơn giản, ít lỗi hơn đầy đủ tính năng).

## Ngoài phạm vi (bàn sau, không code trong bản này)
- Trả phí mua chương.
- Nghe audio trong trang đọc (đã có sẵn file mp3 TTS ở dự án nguồn cho 1 số chương, nhưng tạo audio
  rất lâu nên chưa đưa vào v1).
- Bình luận, đánh giá truyện, trang quản trị (admin dashboard) riêng ngoài luồng "check [tên truyện]".
