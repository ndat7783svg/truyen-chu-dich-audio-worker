# CLAUDE.md

## Mục đích dự án
Website đăng tải các bộ truyện chữ được dịch bằng AI (Trung → Việt), lấy dữ liệu chương từ dự án
dịch riêng biệt tại `D:\translate truyen`. Độc giả vào web đọc truyện; khi user gõ "check [tên bộ
truyện]", Claude vào `D:\translate truyen` kiểm tra chương mới rồi đăng/cập nhật lên đúng bộ truyện
đó trên web.

`D:\translate truyen` là dự án **dịch** (tạo nội dung), độc lập, có `CLAUDE.md` riêng — không sửa
quy tắc dịch ở đó từ dự án này. Dự án này (`website truyện chữ AI`) chỉ **đọc** dữ liệu từ đó rồi
xuất bản lên web, không phải nơi dịch truyện.

## Quy tắc code — LUÔN giao cho Antigravity qua MCP
Mọi việc code (viết tính năng, sửa bug, refactor...) đủ lớn phải giao cho Antigravity qua MCP theo
skill `delegate-antigravity-sk` — Claude đóng vai quản lý (lập plan, duyệt, kiểm tra kết quả thật,
lặp sửa lỗi), không tự code trực tiếp. Ngoại lệ: việc nhỏ/rõ ràng 1-2 bước (sửa vài dòng, đọc/kiểm
tra 1 file) Claude tự làm luôn — xem ngoại lệ trong chính skill đó.

## Kiến trúc đã chốt
- **Next.js (App Router)** + **Vercel** (hosting, domain free `*.vercel.app`) + **Supabase**
  (Postgres DB + Auth) — chọn vì tích hợp DB + đăng ký/đăng nhập trong 1 gói free tier, khớp domain
  Vercel đã chọn, và đã có kinh nghiệm dùng Supabase + Next.js từ project trước.
- Kiến trúc code tổ chức module rõ ràng (core / tính năng / UI) để sau này gắn thêm gói trả phí mua
  chương mà không viết lại từ đầu — nhưng **KHÔNG** tự code phần thanh toán khi chưa được yêu cầu
  rõ ràng.

## Tính năng v1 (đã chốt phạm vi, ưu tiên đơn giản trước)
- Trang chủ: danh sách truyện.
- Trang truyện: thông tin + danh sách chương.
- Trang đọc chương: chỉ hiển thị chữ (chưa làm audio — tạo audio 1 chương rất lâu, chưa cân nhắc).
- Đăng ký / đăng nhập.
- Lưu tiến độ đọc (đọc tiếp từ chương đang dở, cần đăng nhập).
- Tìm kiếm truyện theo tên.
- Dark mode.
- **Hoãn lại, bàn sau:** mục trả phí mua chương; audio trong trang đọc.

## Trạng thái hiện tại
**v1**: Task 1-8 xong + kiểm chứng thật. Task 9 (đăng ký/đăng nhập) đã viết code, đang chờ user tự
test thủ công. Task 10 (dark mode), Task 11 (deploy) chưa làm — xem
`docs/superpowers/plans/2026-09-08-website-truyen-v1.md`.

**Đợt A** (ảnh bìa, tác giả, thể loại, trang chủ/trang truyện nâng cấp — xem spec
`docs/superpowers/specs/2026-09-09-dot-a-metadata-truyen-design.md`, plan
`docs/superpowers/plans/2026-09-09-dot-a-metadata-truyen.md`): **đã xong cả 7 Task + kiểm chứng
thật qua browser + dữ liệu Supabase thật.** `sync-truyen.mjs` giờ tự đọc `thong-tin/thong-tin.md` +
`anh-bia.jpg` bên `D:\translate truyen` mỗi lần "check", không cần nhập tay mô tả nữa.

**Đợt B** (lượt xem, đánh giá sao, "Top thịnh hành", sidebar "Đọc tiếp") — chưa bàn thiết kế, xem
mục "Ngoài phạm vi" trong spec Đợt A.

Xem `NEXT_SESSION.md` để biết bước tiếp theo cụ thể.

## Quy tắc an toàn khi test
Claude KHÔNG tự bấm submit form đăng ký/đăng nhập thật trên Supabase Auth của user (dù chỉ để
test) — hành động này là "tạo tài khoản", thuộc nhóm bị cấm tuyệt đối theo quy tắc an toàn chung.
Luồng đăng ký/đăng nhập/đăng xuất phải để user tự làm thủ công qua trình duyệt, Claude chỉ hướng
dẫn các bước. Chi tiết xem `docs/handoff/an-toan-thao-tac.md`.

## Các file trong bộ quản lý ngữ cảnh — đọc file nào khi nào
| File | Khi nào mở |
|---|---|
| `PROJECT_MAP.md` | Cần biết code/cấu trúc thư mục nằm ở đâu |
| `HANDOFF.md` (mục lục) → `docs/handoff/*.md` | Cần tra lại 1 quyết định/lỗi/kinh nghiệm cụ thể đã gặp trước đây |
| `NEXT_SESSION.md` | Đầu mỗi phiên mới — biết phiên trước đang làm dở gì, cần đọc **trước** khi hỏi lại user |
