# Cập nhật truyện: lỗi mạng giữa chừng + định dạng chương khác nhau giữa các bộ

### 2026-09-13 — WARP ngắt giữa chừng khi đang đăng hàng loạt chương, 1 chương báo lỗi nhưng thực ra đã đăng

- **Hiện tượng**: chạy `sync-truyen.mjs` cho 2 bộ truyện cùng lúc, hàng loạt chương báo
  `TypeError: fetch failed` giữa chừng.
- **Nguyên nhân**: Cloudflare WARP bị ngắt kết nối đúng lúc đang chạy (không phải lỗi code, không
  phải lỗi Supabase) — xem `moi-truong-va-cong-cu.md` mục ISP chặn domain supabase.com. Kiểm tra
  bằng `warp-cli.exe status` xác nhận ngay `Disconnected`.
- **Cách xử lý**: user tự bật lại WARP, Claude chạy lại đúng lệnh `sync-truyen.mjs` cũ — script có
  tính idempotent (kiểm tra `so_chuong` đã tồn tại trước khi insert), tự động chỉ đăng nốt các
  chương còn thiếu, không đăng trùng.
- **Phát hiện thêm đáng nhớ**: 1 chương ("Phàm Trần Phi Tiên" chương 134) nằm trong danh sách "bỏ
  qua do lỗi fetch" ở lần chạy đầu, nhưng khi chạy lại thì KHÔNG xuất hiện trong log (không lỗi,
  không đăng mới) — tra thẳng DB bằng service role key xác nhận chương đó đã tồn tại. Giải thích:
  request insert đã tới server và commit thành công, nhưng phản hồi HTTP bị rớt trên đường về do
  mạng chập chờn, khiến client vẫn coi là lỗi. **Bài học: danh sách "bỏ qua" trong log của 1 lần
  chạy có lỗi mạng KHÔNG đáng tin 100% là những chương đó thực sự thiếu trên DB** — sau khi chạy lại
  xong, luôn xác nhận bằng cách đếm trực tiếp số chương trong DB (so với tổng số file cục bộ), đừng
  chỉ tin log.
- **Script kiểm tra nhanh** (dùng `SUPABASE_SERVICE_ROLE_KEY` có sẵn `.env.local`):
  ```js
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: truyen } = await supabase.from('truyen').select('id').ilike('ten', '%Ten truyen%').maybeSingle();
  const { data: chuongs, count } = await supabase.from('chuong').select('so_chuong', { count: 'exact' }).eq('truyen_id', truyen.id).order('so_chuong');
  // so sánh count/danh sách so_chuong với so file cuc bo
  ```

### 2026-09-13 — Định dạng file chương khác nhau giữa các bộ truyện trong `D:\translate truyen`

- Bộ "Chôn Vùi Nhân Gian Trở Về, Ta Tạo Phản Ngươi Hoảng Cái Gì" xuất chương KHÔNG có dấu `#` ở đầu
  dòng tiêu đề (`Chương 1: ...` thay vì `# Chương 1: ...`) — khác hẳn các bộ trước đó, khiến toàn bộ
  266 file bị `parseChuong` từ chối lúc đầu.
- Theo yêu cầu user ("có chương thì cứ cập nhật đi"), đã sửa `scripts/parse-chuong.js` để chấp nhận
  CẢ 2 định dạng (có `#` và không có `#`) thay vì yêu cầu sửa lại nguồn dịch — không đổi hành vi cũ
  cho file có `#` (kể cả nhánh fallback dùng tiêu đề không khớp `Chương N:`, ví dụ "# Lời mở đầu").
- **Ghi nhớ cho lần "check" sau**: nếu 1 bộ truyện mới báo lỗi "thiếu dòng tiêu đề bắt đầu bằng #"
  cho gần như TOÀN BỘ file (không phải 1-2 file lẻ tẻ), nghi ngay là do khác định dạng nguồn (như
  trường hợp này), không phải file bị hỏng thật — mở 1 file bất kỳ bằng script kiểm tra byte đầu để
  xác nhận trước khi báo user.

### 2026-09-13 — Tính năng mới: báo cáo tính liên tục số chương sau mỗi lần "check"

Theo yêu cầu user, `sync-truyen.mjs` giờ luôn in thêm báo cáo sau khi đăng chương xong (dùng module
mới `scripts/kiem-tra-chuong.js`):
- Liệt kê số chương bị thiếu trong khoảng [min, max] của các file cục bộ hiện có.
- Cảnh báo nếu số chương ghi trong dòng tiêu đề nội dung file khác với số suy ra từ tên file (nghi
  trùng/nhầm số khi dịch).

**Lưu ý quan trọng khi đọc báo cáo này**: nó kiểm tra tính đầy đủ của NGUỒN FILE CỤC BỘ tại
`D:\translate truyen`, KHÔNG kiểm tra những gì đã thực sự đăng lên Supabase. Nếu quá trình đăng bị
lỗi mạng giữa chừng (xem mục đầu file này), báo cáo này vẫn có thể nói "không thiếu chương nào" dù
DB thực tế đang thiếu — vì nó chỉ nhìn vào file, không nhìn vào DB. Muốn biết DB có đủ chương chưa,
phải tra trực tiếp bằng service role key như ở trên.
