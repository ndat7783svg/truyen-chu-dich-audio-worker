# NEXT_SESSION.md

## Cài đặt đọc trong trang chương: xong hoàn toàn + kiểm chứng thật

Brainstorm → spec `docs/superpowers/specs/2026-09-10-cai-dat-doc-chuong-design.md` → plan
`docs/superpowers/plans/2026-09-10-cai-dat-doc-chuong.md` (3 task) → giao Antigravity thực thi →
Claude tự kiểm chứng qua browser thật + đọc lại code.

- [x] Task 1: module thuần `lib/utils/cai-dat-doc.ts` (TDD, 8/8 test pass) — đọc/ghi
      `localStorage` key `caiDatDocTruyen`, chuẩn hóa dữ liệu hỏng về mặc định.
- [x] Task 2: `PanelCaiDatDoc.tsx` (nút "Aa" + dropdown 4 mục) + `KhungDocChuong.tsx` (quản lý
      state + áp dụng style).
- [x] Task 3: gán vào `page.tsx`, build sạch, `npx vitest run` 33/33 pass.
- [x] Kiểm chứng thật qua browser (Claude tự làm): mở panel, đổi từng mục (màu nền Tối/Vàng, cỡ
      chữ A+, phông Cổ điển) áp dụng đúng ngay; reload trang giữ nguyên cài đặt (đọc lại từ
      `localStorage`); Header không bị ảnh hưởng; console không có lỗi JS.
- Lưu ý phát sinh khi giao Antigravity: gọi `use_antigravity` với `mode: "plan"` (chỉ đọc) nhưng
  agy vẫn tự thực thi thật luôn (tạo file, sửa `page.tsx`, chạy build/test) — không phải lỗi, chỉ
  là hành vi thực tế của agy khác mô tả "read-only" của mode này. Không có commit git nào bị agy tự
  tạo. Lần sau cứ coi như `mode: "plan"` cũng có thể ghi file thật, kiểm tra `git status` ngay sau
  khi gọi để biết chắc.

## Task 9 v1 (đăng ký/đăng nhập): xong hoàn toàn, nâng cấp vượt phạm vi v1 gốc

Không chỉ hoàn thành Task 9 v1 cũ (email/mật khẩu đơn giản) mà đã nâng cấp hẳn qua brainstorming →
spec `docs/superpowers/specs/2026-09-10-dang-nhap-dang-ky-google-design.md` → plan
`docs/superpowers/plans/2026-09-10-dang-nhap-dang-ky-google.md` (7 task): thêm xác nhận email thật
(Supabase Auth "Confirm email"), đăng nhập Google OAuth, bảng hồ sơ riêng `public.nguoi_dung` (theo
Profile Pattern chuẩn của Supabase, KHÔNG dùng `user_metadata` — quyết định có chủ đích để làm nền
tảng chắc chắn cho tính năng nạp tiền/mua chương sau này).

- [x] Task 1-6 code xong, build sạch (`npm run build`), test 25/25 pass.
- [x] Task 7 — user đã tự test đủ 7 kịch bản qua browser thật, xác nhận "hoạt động ổn" (đăng ký,
      chặn đăng nhập khi chưa xác nhận email, bấm link xác nhận, đăng nhập lại, Google OAuth, báo
      lỗi sai mật khẩu, báo lỗi trùng email).
- [x] Dọn git hygiene: phát hiện `app/layout.tsx` (gắn `<Header/>`) và `components/NutDangXuat.tsx`
      là phần việc cũ của Task 9 đã code/test xong từ trước nhưng CHƯA TỪNG được commit (dù
      `Header.tsx` đã commit từ lâu import `NutDangXuat` — repo trước đó sẽ lỗi build nếu clone
      mới). Đã commit bổ sung.
- Lỗi phát sinh khi test (không phải lỗi code): Hydration Mismatch ở `app/layout.tsx` do cache
  Turbopack cũ trong lúc dev server chạy lâu — fix bằng xoá thư mục `.next` + restart dev server
  sạch. Nếu gặp lại hiện tượng tương tự (giao diện lỗi lạ không rõ nguyên nhân sau khi sửa nhiều
  file liên tiếp), thử cách này trước khi nghi ngờ code.

## Đợt B (Phần 1 — Lượt xem): xong Task 1-6 + kiểm chứng thật 4/5 kịch bản

Spec `docs/superpowers/specs/2026-09-10-dot-b-luot-xem-design.md` + plan
`docs/superpowers/plans/2026-09-10-dot-b-luot-xem.md` (7 task) đã hoàn thành qua brainstorming →
writing-plans → giao Antigravity thực thi (Claude duyệt, bắt lỗi lệch spec 1 lần — Antigravity ban
đầu làm sai cơ chế dedup thành "30 phút" thay vì "1 lần mãi mãi", đã yêu cầu sửa lại đúng).

- [x] Task 1-6: DB schema (`truyen.luot_xem`, `chuong.luot_xem`, bảng `luot_xem_da_doc`, RPC
      `ghi_luot_xem`), middleware cookie `khach_id`, ghi RPC ở trang đọc chương, hiển thị UI thẻ
      truyện + trang truyện. User đã tự chạy SQL migration qua Supabase Dashboard.
- [x] Task 7 — 4/5 kịch bản đã verify thật qua browser + Supabase (truyện "Tà Tu Hảo A..."): khách
      đọc chương lần đầu tăng đúng 1 (cả cấp chương lẫn truyện), refresh không tăng, đọc chương
      khác tăng tiếp, UI hiển thị đúng số.
- [ ] Kịch bản 4 (visitor_key = `nguoidung:<user_id>` khi đăng nhập) — **cần bạn tự làm**: đăng nhập
      thật rồi đọc 1 chương mới, kiểm tra bảng `luot_xem_da_doc` trên Supabase Dashboard có dòng
      `visitor_key` bắt đầu bằng `nguoidung:` không (Claude không tự đăng nhập tài khoản thật).

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

**Lỗi phát sinh ngoài kế hoạch đã sửa xong (Task 4 + fix bổ sung sau đó)**: `header`/`main` không
giãn hết `max-w-*` như dự kiến (do tương tác `mx-auto` + `body` có `flex flex-col` khiến các thẻ
này co lại theo nội dung thay vì full width) — sửa bằng cách thêm class `w-full` trước `max-w-*`.
Đã áp dụng cho TẤT CẢ trang: `components/Header.tsx`, `app/page.tsx`, `app/the-loai/[slug]/page.tsx`,
`app/truyen/[slug]/page.tsx`, `app/dang-ky/page.tsx`, `app/dang-nhap/page.tsx`,
`app/truyen/[slug]/chuong/[so]/page.tsx` — không còn trang nào sót. Chi tiết kỹ thuật xem
`docs/handoff/layout-flex-w-full.md`.

## Bước tiếp theo — chọn 1 trong các hướng sau, hỏi user trước khi làm

1. **Quay lại v1 còn dở**: Task 10 (dark mode), Task 11 (deploy Vercel). Task 9 đã xong hoàn toàn.
2. **Việc nhỏ còn sót của Đợt B lượt xem**: kịch bản 4 (verify `visitor_key = nguoidung:<user_id>`
   khi đăng nhập đọc chương) — giờ đã có tài khoản thật đăng nhập được (nhờ Task 9 vừa xong), có thể
   nhờ user tiện thể đọc 1 chương lúc đang đăng nhập rồi kiểm tra bảng `luot_xem_da_doc`.
3. **Bàn thiết kế Đợt B phần còn lại** (đánh giá sao, "Top thịnh hành", sidebar "Đọc tiếp") — dùng
   skill `brainstorming` trước khi code, giống quy trình đã làm với Đợt A/lượt xem/đăng nhập.

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
