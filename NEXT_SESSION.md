# NEXT_SESSION.md

## Đang làm dở: Thực thi implementation plan v1

Plan: `docs/superpowers/plans/2026-09-08-website-truyen-v1.md`.

- [x] Task 1: Scaffold Next.js + Supabase client + Vitest.
- [x] Task 2: DB schema Supabase (`truyen`, `chuong`, `tien_do_doc` + RLS).
- [x] Task 3: `scripts/slug.js` (TDD).
- [x] Task 4: `scripts/parse-chuong.js` (TDD) — đã sửa quy ước 3 chữ số, xem
      `docs/handoff/du-lieu-va-parse-chuong.md`.
- [x] Task 5: `scripts/sync-truyen.mjs` — đã chạy thật, đăng 184 chương của "Tà Tu Hảo A, Tà Tu
      Thăng Cấp Khoái" lên Supabase, verify chạy lại không trùng.
- [x] Task 6: Trang chủ (danh sách + tìm kiếm) — verify qua browser OK.
- [x] Task 7: Trang truyện (mô tả + ds chương + nút đọc tiếp) — verify qua browser OK (404 đúng).
- [x] Task 8: Trang đọc chương + lưu tiến độ đọc — verify nav chương trước/sau đúng với dữ liệu
      thật (số chương không liên tục).
- [~] Task 9: Đăng ký/đăng nhập/Header/middleware — **code đã viết xong**
      (`middleware.ts`, `app/dang-ky/page.tsx`, `app/dang-nhap/page.tsx`, `components/Header.tsx`,
      `components/NutDangXuat.tsx`, sửa `app/layout.tsx`), **CHƯA COMMIT**. Đã verify được phần
      không cần tài khoản thật (trang tải không lỗi, form hiện đúng lỗi Supabase). Phần còn lại
      (đăng ký/đăng nhập/đăng xuất thật + kiểm tra `tien_do_doc`) đang **chờ user tự làm thủ công**
      qua trình duyệt (xem `docs/handoff/an-toan-thao-tac.md` — Claude không tự tạo tài khoản).
- [ ] Task 10: Dark mode (chưa bắt đầu).
- [ ] Task 11: Deploy Vercel (chưa bắt đầu, cần user tự làm — xem plan).

## Bước tiếp theo ngay khi vào phiên mới
1. Hỏi user đã tự test xong luồng đăng ký/đăng nhập/đăng xuất + lưu tiến độ đọc chưa (5 bước đã
   đưa ở cuối chat trước). Nếu xong và không lỗi → `git add -A` + commit Task 9, chuyển Task 10.
   Nếu có lỗi → sửa rồi mới commit.
2. Nếu user chưa test, nhắc lại 5 bước (đăng ký email thật → check header đổi → đăng xuất → đăng
   nhập lại → đọc 1 chương rồi xem nút "Đọc tiếp" ở trang truyện).

## Lưu ý quan trọng
- `.env.local` đã điền đủ 4 biến (kể cả `SUPABASE_SERVICE_ROLE_KEY`) — không hỏi lại, không in
  giá trị ra chat.
- Chạy `sync-truyen.mjs` phải dùng `node --env-file=.env.local scripts/sync-truyen.mjs ...`.
- Xem `HANDOFF.md` → `docs/handoff/` nếu gặp lại: lỗi mạng lạ (không phải lỗi code), BOM trong
  `.env.local`, hay nghi ngờ số liệu chương lệch design doc.

## Quyết định đang chờ user
- Kết quả test thủ công luồng đăng ký/đăng nhập ở Task 9 (xem trên).
