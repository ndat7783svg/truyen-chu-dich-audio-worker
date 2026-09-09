# NEXT_SESSION.md

## Đợt A: xong hoàn toàn

Đã hoàn thành + kiểm chứng thật (test/browser + dữ liệu Supabase thật) toàn bộ 7 Task của
`docs/superpowers/plans/2026-09-09-dot-a-metadata-truyen.md`:

- [x] Task 1: DB schema (cột `tac_gia`, bảng `the_loai`/`truyen_the_loai`, bucket Storage `anh-bia`)
      — user đã tự áp dụng SQL qua Supabase Dashboard.
- [x] Task 2: Parser `scripts/parse-thong-tin.js` (TDD, 7/7 test pass).
- [x] Task 3: `sync-truyen.mjs` đọc `thong-tin/thong-tin.md` + `anh-bia.jpg`, upload ảnh, cập nhật
      metadata + gán thể loại — chạy thật 2 lần với dữ liệu "Tà Tu Hảo A..." không lỗi, idempotent.
- [x] Task 4: Trang chủ nâng cấp (component `TheTruyen`, dropdown "Thể loại" trong Header,
      `next.config.ts` cho phép `next/image` tải từ Supabase Storage).
- [x] Task 5: Trang `/the-loai/[slug]`.
- [x] Task 6: Trang truyện nâng cấp (ảnh bìa lớn, tác giả, badge thể loại, mô tả đầy đủ).
- [x] Task 7: Kiểm tra end-to-end qua browser + cập nhật tài liệu trạng thái (file này).

**Lỗi phát sinh ngoài kế hoạch đã sửa luôn trong Task 4**: `header`/`main` không giãn hết
`max-w-*` như dự kiến (do tương tác `mx-auto` + `body` có `flex flex-col` khiến các thẻ này co lại
theo nội dung thay vì full width) — sửa bằng cách thêm class `w-full` trước `max-w-*`. Xem chi tiết
kỹ thuật nên ghi vào `docs/handoff/` nếu gặp lại ở trang khác chưa sửa (vd `app/dang-ky`,
`app/dang-nhap`, `app/truyen/[slug]/chuong/[so]` — các trang này KHÔNG nằm trong Đợt A nên chưa sửa,
vẫn có khả năng bị hiện tượng co hẹp tương tự nếu nội dung thưa).

## Bước tiếp theo — chọn 1 trong các hướng sau, hỏi user trước khi làm

1. **Quay lại v1 còn dở**: Task 9 (chờ user tự test đăng ký/đăng nhập/đăng xuất — xem 5 bước đã đưa
   trước đây), Task 10 (dark mode), Task 11 (deploy Vercel).
2. **Bàn thiết kế Đợt B** (lượt xem, đánh giá sao, "Top thịnh hành", sidebar "Đọc tiếp") nếu user
   muốn tiếp tục nâng cấp tính năng ngay — dùng skill `brainstorming` trước khi code, giống quy
   trình đã làm với Đợt A.
3. **Sửa nốt hiện tượng `w-full` co hẹp** ở các trang chưa đụng tới trong Đợt A (thấp ưu tiên, chỉ
   là cosmetic, chưa gây lỗi chức năng).

## Lưu ý quan trọng
- `.env.local` đã điền đủ 4 biến (kể cả `SUPABASE_SERVICE_ROLE_KEY`) — không hỏi lại, không in
  giá trị ra chat.
- Chạy `sync-truyen.mjs` phải dùng `node --env-file=.env.local scripts/sync-truyen.mjs ...`.
- Xem `HANDOFF.md` → `docs/handoff/` nếu gặp lại: lỗi mạng lạ (không phải lỗi code), BOM trong
  `.env.local`, hay nghi ngờ số liệu chương lệch design doc.
- Dữ liệu chương thật của "Tà Tu Hảo A..." có khoảng trống số chương (2-10 không tồn tại) — không
  phải bug hiển thị, đã xác nhận file gốc bên `D:\translate truyen` cũng không có các file đó.

## Quyết định đang chờ user
- Chọn hướng làm tiếp theo ở mục "Bước tiếp theo" phía trên.
