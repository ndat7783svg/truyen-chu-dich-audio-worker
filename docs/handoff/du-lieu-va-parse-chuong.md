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

### 2026-09-17 — Quy ước "đúng 3 chữ số" ở trên tự phá vỡ khi 1 bộ truyện vượt 999 chương
- Bộ "Đô Thị Chí Tôn" đạt 1626 chương — file `chuong-1000.md` trở lên có 4 chữ số, không khớp regex
  `\d{3}` đã chốt ở mục 2026-09-09. Hậu quả: `readdirSync(...).filter(f => /^chuong-\d{3}\.md$/.test(f))`
  trong `sync-truyen.mjs` và `parseChuong` trong `parse-chuong.js` **âm thầm loại bỏ toàn bộ 627
  chương 1000-1626** — không có cảnh báo, không lỗi, script chỉ báo "Da dang xong" với số chương ít
  hơn thật, dễ khiến người dùng tưởng đã đăng đủ.
- Phát hiện nhờ so sánh trực tiếp `ls .../chuong | wc -l` (1626 file) với log script (chỉ xử lý tới
  999) — không tin log 1 chiều, luôn đối chiếu số file nguồn thật khi số lượng lớn bất thường.
- Đã sửa: đổi cả 2 chỗ (`scripts/parse-chuong.js`, `scripts/sync-truyen.mjs`) sang `\d{3,}` (3 chữ số
  trở lên, không giới hạn trên) — vẫn giữ đúng ràng buộc tối thiểu 3 chữ số (từ chối `chuong-1.md`),
  chỉ bỏ giới hạn trên. Đã kiểm tra toàn bộ các bộ truyện khác lúc đó đều dưới 999 chương nên không
  bộ nào khác bị ảnh hưởng bởi bug này.
- Bài học: một quy ước "chốt cứng" theo dữ liệu hiện có (đúng N chữ số) sẽ vỡ khi dữ liệu tăng vượt
  ngưỡng — với số thứ tự tăng dần vô hạn (số chương, số trang...), nên dùng `\d{3,}` (tối thiểu N,
  không giới hạn trên) ngay từ đầu thay vì `\d{3}` (đúng N), trừ khi có lý do thật sự cần giới hạn
  trên.

### 2026-09-17 — `timMoTa` chỉ nhận 1 tên heading, bộ truyện mới dùng heading khác bị báo lỗi sai chỗ
- `scripts/parse-thong-tin.js` hàm `timMoTa` chỉ khớp heading `## Giới thiệu`; bộ mới "Cẩu Tại Sơ
  Thánh Ma Môn Làm Nhân Tài" dùng heading `## Tóm tắt` cho cùng mục đích → `moTa` ra `null`.
- Vì truyện chưa có trên web (tạo mới), thiếu `moTa` khiến `sync-truyen.mjs` thoát với thông báo
  **"chưa có trên web và không tìm thấy thong-tin/thong-tin.md"** — thông báo này gây hiểu lầm file
  không tồn tại, trong khi file tồn tại và đọc được bình thường, chỉ là nội dung mô tả không khớp
  heading mong đợi. Đã tốn thời gian điều tra nhầm hướng "file có tồn tại hay không" (thêm debug log
  `existsSync` xác nhận `true`) trước khi nhận ra đúng nguyên nhân là logic mô tả, không phải I/O.
- Đã sửa: regex `timMoTa` nhận cả `## Giới thiệu` và `## Tóm tắt`. 13/13 test pass.
- Bài học: khi 1 script báo "không tìm thấy file X" nhưng đã tự kiểm tra file X tồn tại thật, nghi
  ngay là đường thông báo lỗi bị TÁI SỬ DỤNG cho nhiều điều kiện fail khác nhau (ở đây: "thiếu file"
  và "có file nhưng thiếu field bắt buộc" dùng chung 1 dòng `console.error`) — đọc thẳng code quanh
  chỗ in ra thông báo đó thay vì tin nghĩa đen của thông báo.
