# HANDOFF.md — Mục lục nhật ký kỹ thuật

Nội dung thật nằm trong `docs/handoff/<chủ-đề>.md` (append-only, tách theo chủ đề/tính năng —
KHÔNG theo buổi làm việc). File này chỉ liệt kê chủ đề đang có.

| Chủ đề | File | Mô tả |
|---|---|---|
| An toàn thao tác test | [docs/handoff/an-toan-thao-tac.md](docs/handoff/an-toan-thao-tac.md) | Không tự submit form đăng ký/đăng nhập thật (= tạo tài khoản) |
| Môi trường & công cụ | [docs/handoff/moi-truong-va-cong-cu.md](docs/handoff/moi-truong-va-cong-cu.md) | BOM trong `.env.local`, chạy sync script cần `--env-file`, ISP chặn domain (không phải lỗi code) |
| Dữ liệu thật & parse chương | [docs/handoff/du-lieu-va-parse-chuong.md](docs/handoff/du-lieu-va-parse-chuong.md) | Số chương thật lệch design doc, bug `parseChuong` bị test bắt trước khi commit |
| Layout flex/`w-full` | [docs/handoff/layout-flex-w-full.md](docs/handoff/layout-flex-w-full.md) | `max-w-* mx-auto` bị co hẹp khi là con trực tiếp của `body { flex flex-col }`, phải thêm `w-full` |
| CSS stacking context & `<script>` trong JSX | [docs/handoff/css-stacking-context-va-script-tag.md](docs/handoff/css-stacking-context-va-script-tag.md) | `opacity<1` tự tạo stacking context đè lên `absolute` đứng trước; dùng `next/script` thay `<script>` thô để tránh warning React |
| Server action nuốt lỗi Supabase & race condition nút bấm | [docs/handoff/loi-server-action-nuot-loi-supabase.md](docs/handoff/loi-server-action-nuot-loi-supabase.md) | Bảng DB chưa tồn tại làm action fail âm thầm không exception; cách tra nhanh bằng service role key; luôn khoá nút trong lúc chờ xử lý |
| Cập nhật truyện: lỗi mạng & định dạng khác nhau | [docs/handoff/cap-nhat-truyen-loi-mang-va-dinh-dang.md](docs/handoff/cap-nhat-truyen-loi-mang-va-dinh-dang.md) | WARP ngắt giữa chừng khi đăng hàng loạt chương, log "lỗi fetch" không đáng tin 100%; định dạng tiêu đề chương khác nhau giữa các bộ (có/không "#") |
| Deploy Vercel + mua domain Namecheap | [docs/handoff/deploy-vercel-va-domain.md](docs/handoff/deploy-vercel-va-domain.md) | Quy trình `vercel login`/`link`/`env add`/`--prod`; bug stdin bị lệch khi set env trong vòng lặp; trỏ DNS Namecheap; WARP chặn IP `76.76.21.21` của Vercel |
| Thanh loading khi chuyển trang | [docs/handoff/thanh-loading-chuyen-trang.md](docs/handoff/thanh-loading-chuyen-trang.md) | Next.js App Router không có loading mặc định — cần `loading.tsx` + progress bar tự viết; phân biệt "chậm" vs "không phản hồi trực quan"; giới hạn không bắt được `router.push()`; xung đột `npm run build` chạy song song `next dev` |
| Bảo mật: RLS chặn nội dung chương VIP | [docs/handoff/bao-mat-rls-chan-noi-dung-vip.md](docs/handoff/bao-mat-rls-chan-noi-dung-vip.md) | RLS Postgres chỉ chặn theo HÀNG không theo CỘT; REVOKE 1 cột không đủ nếu đã GRANT toàn bảng; PostgREST không tương thích quyền cấp-cột với đếm gộp `table(count)`; `curl` không xác minh đúng `redirect()` khi Suspense đang streaming |
| Hiệu năng: danh sách chương, region Vercel/Supabase, rate limit prefetch | [docs/handoff/hieu-nang-danh-sach-chuong-vercel-region.md](docs/handoff/hieu-nang-danh-sach-chuong-vercel-region.md) | Phân trang 50 chương/nhóm; region Vercel (`iad1` mặc định) lệch Supabase (Singapore) gây chậm toàn site; Next.js tự prefetch `<Link>` hiển thị cộng dồn vào rate limit làm chặn nhầm khách thật |
| Tính năng "Nghe chương" + nghiên cứu TTS tạo file audio | [docs/handoff/tinh-nang-nghe-chuong-va-nghien-cuu-tts.md](docs/handoff/tinh-nang-nghe-chuong-va-nghien-cuu-tts.md) | Bug Tạm dừng/Tiếp tục Web Speech API không đáng tin cậy giữa trình duyệt, cờ boolean lọc sự kiện cũ bị kẹt (đổi sang đánh số thế hệ); benchmark thật `edge-tts` song song 1/4/10/30/70 chương — giới hạn an toàn ~20-30, tại 70 lỗi ~53%; giới hạn nền tảng không nghe được khi tắt màn hình (Web Speech API) |
