# Hiệu năng: danh sách chương dài, chuyển chương chậm, region Vercel/Supabase lệch nhau

## Vấn đề ban đầu (2026-09-15)

User báo web load chậm bất thường qua tab khác, đặc biệt chuyển chương đọc rất lâu. Đọc code tìm ra
3 nguyên nhân thật (không phải bot cào lần này):

1. **`app/truyen/[slug]/page.tsx`** render TOÀN BỘ danh sách chương trong 1 `<ul>` (có truyện tới
   767 chương) trong 1 lần tải — trang quá dài, chậm render.
2. **`app/truyen/[slug]/chuong/[so]/page.tsx`** fetch lại TOÀN BỘ danh sách chương mỗi lần chuyển
   chương chỉ để hiện 1 dropdown nhỏ — lặp lại query nặng không cần thiết ở mỗi điều hướng.
3. **`middleware.ts`** gọi `supabase.auth.getUser()` (round-trip mạng thật) trên MỌI request toàn
   site (không riêng `/truyen/*`), kể cả khách chưa đăng nhập chẳng có phiên nào cần refresh.

## Fix

- Trang truyện: tách `DanhSachChuongTruyen.tsx` (client), chia nhóm 50 chương
  (`lib/utils/chuong.ts`: `tinhSoNhom`, `tinhNhomCuaChuong`, `taoDanhSachNhom`, `catChuongTheoNhom`
  — TDD 12/12 test), chuyển nhóm tại chỗ bằng React state, không tải lại trang/đổi URL.
- Trang đọc chương: SSR chỉ fetch 1 nhóm 50 chương chứa chương đang đọc thay vì toàn bộ; dropdown
  `DanhSachChuong.tsx` tải thêm nhóm khác on-demand qua server action
  `lib/actions/lay-nhom-chuong.ts`, cache lại nhóm đã tải trong state (không fetch lại nhóm cũ).
- `middleware.ts`: chỉ gọi `supabase.auth.getUser()` khi request có cookie phiên đăng nhập Supabase
  (tên bắt đầu `sb-` chứa `-auth-token`) — khách vãng lai (không cookie) bỏ qua hoàn toàn bước này.

Giao Antigravity qua MCP (`mode: "plan"` rồi tự duyệt cho chạy thật — lưu ý agy vẫn tự thực thi file
thật dù gọi mode "plan", đã biết từ trước). Build sạch, 87/87 test pass, kiểm chứng qua browser trên
truyện 767 chương (chia đúng 16 nhóm, chuyển nhóm không tải lại trang, dropdown tải nhóm khác đúng).

## Region Vercel lệch Supabase — nguyên nhân chính của độ trễ chung

Sau khi vá xong 3 việc trên, đo lại TTFB thật bằng `curl` trên production vẫn thấy chậm (0.85-1.4s
mỗi trang). `npx vercel inspect <deployment>` phát hiện: **hàm server Vercel chạy ở `iad1`
(Washington D.C., Mỹ)** — mặc định do lần deploy đầu tiên chưa từng cấu hình region — trong khi
**Supabase đặt tại Singapore** (user tự thiết lập, theo hướng dẫn). Mỗi truy vấn database phải đi
vòng xuyên lục địa, cộng dồn 1-2 giây mỗi trang do nhiều query tuần tự.

Fix: thêm `vercel.json`:
```json
{ "regions": ["sin1"] }
```
Deploy lại, `npx vercel inspect` xác nhận hàm server đã chuyển sang `sin1`. Đo lại bằng `curl`: TTFB
giảm còn ~0.4-0.7s (nhanh gấp đôi, trừ request đầu tiên chậm hơn do cold start bình thường sau khi
đổi region).

**Bài học**: khi deploy Vercel + Supabase (hoặc bất kỳ DB ngoài khác), luôn kiểm tra region hai bên
có khớp nhau không ngay từ đầu (`npx vercel inspect <deployment>` xem dòng region của từng hàm) —
mặc định Vercel Hobby chọn Mỹ (`iad1`) bất kể user ở đâu hay DB đặt ở đâu, dễ bị bỏ sót vì app vẫn
"chạy được", chỉ chậm chứ không lỗi.

## Tác dụng phụ: rate limit chặn nhầm khách đọc bình thường

Sau khi các fix trên lên production, user báo bị chặn "Bạn thao tác quá nhanh" dù bấm tốc độ bình
thường. Nguyên nhân: Next.js App Router **tự động gửi request "prefetch" cho mọi `<Link>` đang hiển
thị trên màn hình** (không phải do người dùng chủ động bấm) — trang danh sách chương giờ hiện tới 50
link cùng lúc (đúng tính năng vừa làm ở trên) nên tự tạo ra nhiều request prefetch tới cùng nhóm URL
`/truyen/*` đang bị giới hạn tốc độ (15 request/10 giây, xem
[giới-han-bot-cao-du-lieu](../superpowers/specs/2026-09-14-gioi-han-bot-cao-du-lieu-design.md)),
cộng dồn với điều hướng thật khiến khách đọc bình thường cũng dễ vượt ngưỡng.

Fix trong `middleware.ts`: nhận diện request prefetch qua header Next.js 16 tự gắn
(`next-router-prefetch`, `next-router-segment-prefetch` — xem
`node_modules/next/dist/client/components/app-router-headers.d.ts` để tra tên header chính xác theo
từng version Next.js) và bỏ qua hoàn toàn khỏi bộ đếm giới hạn tốc độ — không ảnh hưởng khả năng
chặn bot cào thật (bot dùng HTTP request thô không mang các header này).

**Bài học**: khi thêm rate limit theo URL cho 1 route Next.js App Router có nhiều `<Link>` hiển thị
cùng lúc, phải tính đến prefetch tự động ngay từ đầu (không chỉ đếm điều hướng thật) — nếu không sẽ
chặn nhầm người dùng thật, đặc biệt rõ sau khi tối ưu UX làm hiện nhiều link hơn (như phân trang
danh sách chương ở trên).
