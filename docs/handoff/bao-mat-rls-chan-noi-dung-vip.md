# Bảo mật: chặn đọc thẳng nội dung chương VIP qua Supabase REST API

## Phát hiện lỗ hổng (2026-09-15)

User gửi 1 bài viết cảnh báo về sự cố bảo mật của 1 vibe coder khác (VPS lộ port, CVE Next.js...),
yêu cầu rà soát bảo mật cho website. Hầu hết rủi ro trong bài không áp dụng (dùng Vercel serverless
+ Supabase managed, không có VPS/port; Next.js 16.3.4 đã qua CVE-2025-29927 từ lâu).

Nhưng tự đọc `supabase/schema.sql` phát hiện lỗ hổng **nghiêm trọng hơn cả bài viết**: chính sách
RLS cũ của bảng `chuong` (`create policy "chuong doc cong khai" on chuong for select using (true)`)
cho phép đọc tự do **mọi cột kể cả `noi_dung`** của **mọi chương**, trong khi khoá "chỉ chương ≤50
đọc free, còn lại cần gói VIP" (`SO_CHUONG_FREE` trong `lib/config/goi-vip.ts`) **chỉ được kiểm tra
ở tầng ứng dụng** (`app/truyen/[slug]/chuong/[so]/page.tsx`). Ai gọi thẳng Supabase REST API bằng
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, lộ sẵn trong mã nguồn mọi trang) là đọc được full nội dung
mọi chương VIP miễn phí, không cần đăng nhập hay trả tiền — đã xác minh khai thác thật bằng `curl`
trước khi vá (lấy được nguyên văn 1 chương VIP thật).

## Vì sao mất 3 lần sửa mới đúng

Postgres RLS **chỉ chặn được theo HÀNG (row), không chặn riêng theo CỘT (column)**. Bài học chính
của cả quá trình vá:

**Bản 1 (SAI)**: đổi policy SELECT của `chuong` theo điều kiện `so_chuong <= 50 or (có VIP)`. Chặn
đúng nội dung VIP, nhưng vì chặn theo HÀNG nên **toàn bộ metadata** (tiêu đề, số chương) của chương
VIP cũng biến mất theo — vỡ tính năng "danh sách chương chia nhóm 50" (chỉ còn thấy 50/767 chương)
và trang đọc chương VIP trả về 404 thay vì đúng ra phải mời đăng nhập/mua gói (vì `page.tsx` không
còn query được row đó nữa để biết chương có tồn tại hay không).

**Bản 2 (vẫn SAI, tưởng đúng)**: quay lại policy đọc công khai theo hàng (`using (true)`, khôi phục
metadata), rồi `revoke select (noi_dung) on chuong from anon, authenticated;` để chặn riêng 1 cột.
**Không có tác dụng** — Postgres đã cấp `GRANT SELECT` (toàn bảng, mọi cột) mặc định cho vai trò
`anon`/`authenticated` từ lúc tạo bảng, và REVOKE 1 cột không ghi đè được quyền toàn bảng đã cấp sẵn
rộng hơn. Test lại bằng `curl` vẫn đọc được `noi_dung` bình thường.

**Bản 3 (đúng)**: phải REVOKE **toàn bảng** trước rồi GRANT lại đúng danh sách cột an toàn:
```sql
revoke select on chuong from anon, authenticated;
grant select (id, truyen_id, so_chuong, tieu_de, created_at, luot_xem) on chuong to anon, authenticated;
```
Muốn đọc `noi_dung` bắt buộc phải qua hàm `lay_noi_dung_chuong(p_chuong_id uuid)` (SECURITY DEFINER,
tự kiểm tra `so_chuong <= 50` hoặc gói VIP hiệu lực mới trả về, ngược lại trả `null`). Code
`page.tsx` đổi từ select thẳng cột `noi_dung` sang gọi RPC này SAU KHI đã qua gate VIP hiện có (giữ
nguyên logic `redirect('/dang-nhap')` + `<ChanChuongVip/>` cũ — RPC chỉ là lớp phòng thủ thứ 2 ở
database, không thay thế logic ứng dụng).

**Bản 4 (sửa tác dụng phụ của bản 3)**: sau khi REVOKE toàn bảng, tính năng đếm số chương lồng ghép
của PostgREST (`chuong(count)`, dùng ở `app/page.tsx` + `app/the-loai/[slug]/page.tsx` để hiện "X
chương" trên thẻ truyện) bị từ chối hoàn toàn (`permission denied for table chuong`) dù cột cần
thiết (`truyen_id`) đã được cấp quyền — **PostgREST đòi hỏi quyền SELECT ở cấp bảng cho kiểu đếm gộp
này, không chấp nhận quyền cấp theo cột**. Hậu quả: production mất trắng, trang chủ hiện "Không tìm
thấy truyện nào." dù dữ liệu vẫn nguyên vẹn — phát hiện qua ảnh chụp màn hình thật của user.

Giải pháp: tạo 1 VIEW riêng chỉ chứa số đếm, không đụng cột nào của `chuong` gốc:
```sql
create or replace view public.truyen_so_chuong as
select truyen_id, count(*)::int as so_chuong from chuong group by truyen_id;

grant select on public.truyen_so_chuong to anon, authenticated;
```
`app/page.tsx`/`app/the-loai/[slug]/page.tsx` đổi từ embed `chuong(count)` sang query riêng vào view
này rồi map số chương theo `truyen_id` trong code (không còn dựa vào PostgREST embed nữa).

## Bài học tổng quát cho lần sau

- **RLS = theo hàng, không theo cột.** Muốn giấu 1 cột nhạy cảm (ví dụ nội dung trả phí) mà vẫn cho
  đọc công khai các cột khác của cùng hàng, phải dùng REVOKE/GRANT cấp cột (nhớ REVOKE TOÀN BẢNG
  trước, không REVOKE lẻ 1 cột) + 1 hàm SECURITY DEFINER riêng để đọc cột đó có điều kiện. Không có
  cách nào làm việc này chỉ bằng 1 policy RLS.
- **PostgREST không tương thích quyền cấp-theo-cột cho: đếm gộp lồng ghép (`table(count)`), có thể
  cả các dạng embed/join phức tạp khác chưa gặp.** Khi cần đếm/join dữ liệu từ 1 bảng đã bị giới hạn
  cột, tạo VIEW riêng (không chứa cột nhạy cảm) rồi query/join vào VIEW đó thay vì embed trực tiếp
  bảng gốc.
- **Sau bất kỳ thay đổi RLS/GRANT nào, phải test lại TOÀN BỘ các luồng đọc dữ liệu liên quan** (không
  chỉ luồng vừa sửa) bằng `curl` thẳng vào Supabase REST API VÀ qua browser thật — 1 thay đổi tưởng
  cô lập (chặn 1 cột của 1 bảng) có thể vỡ tính năng ở trang hoàn toàn khác (trang chủ) tưởng chừng
  không liên quan, vì PostgREST dùng chung 1 bảng cho nhiều mục đích query khác nhau.
- **`curl` không thể xác minh đúng hành vi `redirect()` của Next.js App Router.** Khi `redirect()`
  xảy ra sau khi phần khung trang đã bắt đầu streaming (Suspense), Next.js trả về HTTP 200 kèm 1
  đoạn HTML fallback "404" ẩn (dự phòng khi tắt JavaScript) + cơ chế chuyển hướng bằng
  `<meta http-equiv="refresh">`/script — `curl | grep "404"` sẽ khớp nhầm đoạn HTML ẩn này và báo
  "lỗi" giả dù trình duyệt thật vẫn chuyển hướng đúng. Luôn xác minh lại bằng browser thật (đọc nội
  dung hiển thị, không chỉ status code/text thô) trước khi kết luận có regression hay không.

## Xác minh cuối cùng (đã pass)

- `curl` thẳng Supabase REST API: đọc cột `noi_dung` chương >50 → `permission denied`; đọc metadata
  (tiêu đề, số chương) → vẫn đọc được; gọi RPC `lay_noi_dung_chuong` cho chương free → có nội dung
  thật; cho chương VIP chưa đăng nhập → `null`.
- Browser thật trên production: trang chủ + trang thể loại hiện đủ 5 truyện đúng số chương; trang
  truyện hiện đủ danh sách chương chia nhóm 50; chương free đọc bình thường; chương VIP chưa đăng
  nhập chuyển đúng sang `/dang-nhap`; console sạch lỗi.
