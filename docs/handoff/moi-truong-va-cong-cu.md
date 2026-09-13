# Môi trường & công cụ

### 2026-09-09 — File `.env.local` có BOM, phải bỏ anchor `^` khi grep
- **Vấn đề**: script/kiểm tra dùng `grep "^NEXT_PUBLIC_SUPABASE_URL="` trả về rỗng dù biến có
  trong file.
- **Nguyên nhân**: `.env.local` (do Antigravity tạo) có BOM (`EF BB BF`) ở đầu file, khiến dòng
  đầu tiên không thực sự bắt đầu bằng tên biến.
- **Cách xử lý**: khi cần đọc giá trị từ file này bằng `grep`/`cut`, bỏ anchor `^`, dùng
  `grep -o "TEN_BIEN=.*"` thay vì `grep "^TEN_BIEN="`. Next.js và package `dotenv` tự bỏ BOM nên
  không ảnh hưởng lúc chạy app.

### 2026-09-09 — Chạy `scripts/sync-truyen.mjs` phải nạp env bằng `--env-file`
- Script Node độc lập (không phải Next.js) không tự đọc `.env.local`. Node 20.6+ hỗ trợ sẵn:
  ```
  node --env-file=.env.local scripts/sync-truyen.mjs "<Ten truyen>" [--mo-ta "..."]
  ```
  Máy đang dùng Node v24 nên chạy thẳng được, không cần cài `dotenv`.

### 2026-09-09 — Warning vô hại của Vitest, bỏ qua được
- `npx vitest run` luôn in warning `configLoader: 'native'` / ESM syntax trong `vitest.config.ts`
  (CommonJS loader). Không phải lỗi, test vẫn chạy đúng — không cần sửa.

### 2026-09-09 — Không vào được github.com/vercel.com/supabase.com trên máy (không phải lỗi code)
- Máy user từng không vào được 3 trang trên (timeout) trong khi Google/Facebook/npm registry vẫn
  vào bình thường, cả trên WiFi nhà (4G vẫn vào được).
- Đã loại trừ: DNS (resolve đúng IP), firewall Windows (có 1 rule thừa
  `codex_sandbox_offline_block_outbound` do công cụ khác để lại — đã tắt nhưng không phải nguyên
  nhân chính), proxy/VPN (không có).
- Kết luận: ISP chặn theo tên miền (DPI/SNI filtering) — bằng chứng: `raw.githubusercontent.com`
  và `cloudflare.com` vẫn vào được nhưng `github.com`/`vercel.com`/`supabase.com` bị chặn riêng.
  Đã fix bằng Cloudflare WARP (chế độ **WARP** đầy đủ, không phải "DNS only").
- Nếu gặp lại triệu chứng "vào được vài trang, không vào được vài trang khác, DNS vẫn đúng" trên
  máy này → nghi ISP chặn domain trước, đừng nghĩ ngay là lỗi code/deploy.

### 2026-09-11 — `use_antigravity` với `mode: "plan"` vẫn tự thực thi thật (ghi file/chạy lệnh)
- **Hiện tượng**: gọi tool với `mode: "plan"` (đáng lẽ chỉ đọc/phân tích, chưa ghi gì) nhưng
  Antigravity vẫn tự tạo/sửa file thật, tự chạy `npm run build`/`npm run test` luôn trong cùng 1
  lượt gọi — đã lặp lại ít nhất 2 lần (đợt cài đặt đọc chương 2026-09-10, đợt thanh điều
  hướng/Tài khoản/theme 2026-09-11), không phải sự cố ngẫu nhiên.
- **Không gây hại** vì Antigravity không tự `git commit` — Claude vẫn kiểm tra `git status`/đọc lại
  file/chạy build+test độc lập trước khi commit, nên sai sót (nếu có) vẫn bị chặn lại ở bước duyệt.
- **Cách xử lý**: coi `mode: "plan"` chỉ là gợi ý hành vi (best-effort), không phải cam kết kỹ
  thuật thật của công cụ — luôn tự kiểm tra `git status`/`git diff` ngay sau lời gọi đầu tiên (dù
  là "plan") thay vì đợi tới bước `accept-edits` mới kiểm tra.
