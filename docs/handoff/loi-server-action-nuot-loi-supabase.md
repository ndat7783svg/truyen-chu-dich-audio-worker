# Server action "chạy nhưng không có tác dụng" — bảng DB chưa tồn tại, lỗi Supabase bị nuốt

### 2026-09-13 — Nút Lưu truyện fail âm thầm vì user quên chạy SQL migration

- **Hiện tượng**: Sau khi Antigravity code xong tính năng "Đã lưu" (nút bấm gọi server action
  `luuTruyen`), user bấm nút thì UI đổi trạng thái rồi lập tức quay lại như cũ, không thấy gì trong
  danh sách "Đã lưu". Log server (`npm run dev`) không hề có exception nào, request trả về 200 bình
  thường.
- **Nguyên nhân thật**: User chưa chạy đoạn SQL migration tạo bảng `truyen_da_luu` qua Supabase
  Dashboard (bước "dừng lại chờ user" trong plan implementation) — bảng chưa tồn tại. Code
  `actions-luu.ts` chỉ bắt `const { error } = await supabase.from(...).insert(...)` rồi trả về
  `thanhCong: !error` — không throw, không log — nên lỗi "table not found" từ Supabase bị nuốt hoàn
  toàn, chỉ biểu hiện ra ngoài là "trạng thái UI bị rollback" mà không có dấu vết gì trong log server
  hay console trình duyệt.
- **Cách chẩn đoán nhanh** (đáng nhớ để lần sau khỏi mò log): dùng
  `SUPABASE_SERVICE_ROLE_KEY` (đã có sẵn trong `.env.local`) viết 1 script Node ngắn gọi thẳng
  `supabase.from('ten_bang').select('*').limit(5)` để xem lỗi gốc thật của Postgres/PostgREST —
  nhanh hơn nhiều so với thêm debug log rải rác vào code rồi build lại:
  ```js
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  supabase.from('ten_bang').select('*').limit(5).then(r => console.log(r));
  ```
  Lỗi trả về thẳng `PGRST205: Could not find the table 'public.ten_bang' in the schema cache` —
  xác nhận ngay lập tức, không cần đoán qua RLS/logic code.
- **Bài học**: khi 1 action ghi DB "chạy xong nhưng như không có gì xảy ra" (không exception, không
  gì trong console) — nghi ngay bảng/cột chưa tồn tại hoặc RLS chặn âm thầm, TRƯỚC KHI nghi code
  logic sai. Đặc biệt sau khi giao Antigravity code 1 tính năng có kèm bước "user tự chạy SQL migr-
  ation" — luôn hỏi lại/xác nhận đã chạy SQL thật chưa trước khi debug sâu vào code.
- Không liên quan tới lỗi `AuthRetryableFetchError`/ISP chặn domain đã ghi ở
  `moi-truong-va-cong-cu.md` — 2 hiện tượng có vẻ giống nhau (đều là "web chạy chậm/lỗi mạng linh
  tinh") nhưng gốc rễ khác hẳn, đừng nhầm lẫn khi gặp lại.

### 2026-09-13 — Nút bấm không khoá trạng thái "đang xử lý" dễ gây race condition khi mạng/dev chậm

- Next.js dev mode (Turbopack) có thể mất 1-3 giây, thậm chí 20-60 giây cho lần compile đầu 1 route
  mới — nếu nút bấm (ví dụ nút Lưu/Bỏ lưu) không tự khoá (`disabled`) trong lúc chờ server action
  trả về, user dễ bấm thêm lần nữa vì tưởng chưa ăn, gây 2 request chồng nhau (insert trùng PK, hoặc
  delete 2 lần liên tiếp) làm UI hiển thị sai lệch so với DB thật.
- **Cách phòng ngừa**: mọi nút gọi server action làm thay đổi dữ liệu nên có 1 state `dangXuLy`
  (boolean), set `true` trước khi gọi action, `disabled={dangXuLy}` trên nút, chặn gọi lại nếu đang
  `true`, set về `false` sau khi action trả về (dù thành công hay thất bại). Áp dụng ở
  `NutLuuTruyen.tsx` và `DongTruyenDaLuu.tsx`.
