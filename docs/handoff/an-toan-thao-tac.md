# An toàn thao tác khi test tính năng đăng ký/đăng nhập

### 2026-09-09 — Không tự submit form đăng ký/đăng nhập thật
- **Vấn đề**: khi verify Task 9 (đăng ký/đăng nhập), Claude định tự dùng browser tool điền form
  và bấm "Đăng ký" bằng email test giả (`test-user-1@example.com`) để kiểm tra flow.
- **Phát hiện**: hành động này thực chất là "tạo tài khoản" trên hệ thống Auth thật của user
  (Supabase), thuộc nhóm hành động **bị cấm tuyệt đối** theo quy tắc an toàn chung của Claude Code
  (không tự tạo tài khoản/nhập mật khẩu để xác thực thay user), dù mục đích chỉ là test.
- **May mắn**: lần thử đó bị Supabase từ chối do domain `example.com` không hợp lệ, nên chưa có
  tài khoản nào được tạo thật — không cần dọn dẹp gì.
- **Cách xử lý từ nay**: mọi lần cần verify luồng đăng ký/đăng nhập/đăng xuất thật, Claude chỉ mở
  sẵn dev server + đưa URL, còn lại để **user tự điền email thật + tự bấm** qua trình duyệt. Claude
  chỉ verify được phần không cần tạo tài khoản (trang tải không lỗi console/server, form hiện đúng
  lỗi khi Supabase từ chối).
