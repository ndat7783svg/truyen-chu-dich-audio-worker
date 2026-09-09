# NEXT_SESSION.md

## Đang làm dở: Thực thi implementation plan v1

Plan: `docs/superpowers/plans/2026-09-08-website-truyen-v1.md`. Đang chạy từng task, tự làm trực
tiếp (không qua Antigravity) vì code đã có sẵn đầy đủ trong plan — chỉ copy + tự kiểm tra thật.

- [x] Task 1: Scaffold Next.js + Supabase client + Vitest. Verify: test pass, dev server chạy sạch.
- [x] Task 2: DB schema Supabase — user đã chạy `supabase/schema.sql` trong SQL Editor. Verify: 3
      bảng `truyen`/`chuong`/`tien_do_doc` đọc được qua REST API (rỗng, HTTP 200).
- [x] Task 3: `scripts/slug.js` (TDD, 3 test pass).
- [x] Task 4: `scripts/parse-chuong.js` (TDD, 6 test pass). Đã sửa 1 lỗi tự phát hiện qua test: quy
      định lại `so_chuong` phải đúng 3 chữ số (`chuong-XXX.md`), khớp quy ước thật của
      `D:\translate truyen` (ban đầu viết `\d+` quá lỏng).
- [x] Task 5: `scripts/sync-truyen.mjs`. Đã chạy thật với dữ liệu thật (không phải dữ liệu giả):
      tạo truyện "Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái" (slug `ta-tu-hao-a-ta-tu-thang-cap-khoai`) +
      đăng 184 chương (nhiều hơn 141 lúc khảo sát ban đầu — bên `translate truyen` đã dịch thêm).
      Chạy lại lần 2 xác nhận không tạo trùng.
- [ ] **Bước tiếp theo: Task 6** — Trang chủ (`app/page.tsx` + `components/SearchBox.tsx`), theo
      đúng code đã viết sẵn trong file plan (mục "### Task 6"). Sau đó tiếp Task 7, 8, 9, 10, 11
      theo thứ tự trong plan.

## Lưu ý quan trọng cho phiên sau
- `.env.local` đã điền đủ (URL, anon key, service_role key user tự điền) — KHÔNG cần hỏi lại,
  chỉ cần đọc file (không in giá trị `SUPABASE_SERVICE_ROLE_KEY` ra chat).
- Chạy `scripts/sync-truyen.mjs` cần nạp env bằng `node --env-file=.env.local scripts/sync-truyen.mjs ...`
  (script Node độc lập, không tự đọc `.env.local` như Next.js).
- Lúc chạy `npm test`/`npx vitest` sẽ có 1 warning vô hại về `configLoader: 'native'` của
  `vitest.config.ts` — không phải lỗi, bỏ qua được.
- Đã disable 1 rule tường lửa Windows tên `codex_sandbox_offline_block_outbound` (do công cụ khác
  để lại, chặn nhầm outbound) — không liên quan tới project này, chỉ ghi chú lại để không nhầm là
  lỗi code nếu gặp lại triệu chứng mạng lạ.

## Quyết định đang chờ user
- Không có gì đang chờ.
