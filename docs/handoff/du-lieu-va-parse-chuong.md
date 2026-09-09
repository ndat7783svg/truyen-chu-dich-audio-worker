# Dữ liệu thật & parse chương

### 2026-09-09 — Số chương thật (184) nhiều hơn lúc khảo sát ban đầu (141)
- Lúc brainstorm/viết design doc, khảo sát `danh-sach-truyen/Tà Tu Hảo A.../chuong/` thấy 141 file.
- Lúc chạy `sync-truyen.mjs` thật (Task 5) thì đếm được 184 file — bên `D:\translate truyen` đã
  dịch thêm trong lúc phiên này diễn ra (khoảng cách vài ngày giữa brainstorm và lúc code xong).
- Không phải bug — script tự đọc đúng số file hiện có, không cần sửa gì. Ghi lại để phiên sau
  không hoang mang khi số liệu lệch với design doc.

### 2026-09-09 — `parseChuong` ban đầu chấp nhận số chương sai định dạng
- Test tự viết (`scripts/parse-chuong.test.js`) kỳ vọng `chuong-1.md` (1 chữ số) phải bị từ chối,
  nhưng regex ban đầu `/^chuong-(\d+)\.md$/` (chép từ design doc) lại chấp nhận mọi số chữ số.
- Test bắt lỗi này trước khi commit → sửa thành `/^chuong-(\d{3})\.md$/` (đúng 3 chữ số, khớp quy
  ước thật của `D:\translate truyen`: `chuong-001.md`...). Đã đồng bộ luôn filter file trong
  `sync-truyen.mjs` sang `\d{3}`.
- Bài học: dù code đã "chốt" trong plan, vẫn phải chạy test thật trước khi tin — plan cũng có thể
  sai.
