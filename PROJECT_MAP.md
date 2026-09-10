# PROJECT_MAP.md

Bản đồ kiến trúc dự án website đọc truyện (cập nhật sau khi hoàn thành v1 + Đợt A + Đợt B Phần 1 +
đăng ký/đăng nhập nâng cấp).

## Cấu trúc thực tế
```
website truyện chữ AI/
├── CLAUDE.md                       (mục đích + quy tắc dự án)
├── PROJECT_MAP.md                   (file này - bản đồ kiến trúc tra cứu nhanh)
├── HANDOFF.md                       (mục lục nhật ký kỹ thuật)
├── NEXT_SESSION.md                  (bàn giao phiên đang dở)
├── docs/
│   ├── superpowers/specs/           (spec đã brainstorm + user duyệt)
│   ├── superpowers/plans/           (implementation plan theo từng spec)
│   └── handoff/                     (nhật ký kỹ thuật chi tiết theo chủ đề)
├── middleware.ts                    (refresh session Supabase Auth + cấp cookie khach_id mỗi request)
├── next.config.ts                   (cho phép next/image tải ảnh bìa từ Supabase Storage)
├── app/                             (Next.js App Router)
│   ├── layout.tsx                   (root layout, gắn <Header/>)
│   ├── page.tsx                     (trang chủ - lưới thẻ truyện + tìm kiếm)
│   ├── globals.css
│   ├── auth/callback/route.ts       (route PKCE dùng chung cho Google OAuth + link xác nhận email)
│   ├── truyen/[slug]/
│   │   ├── page.tsx                 (trang truyện - ảnh bìa, tác giả, thể loại, mô tả, lượt xem, ds chương)
│   │   └── chuong/[so]/
│   │       ├── page.tsx             (trang đọc chương - ghi RPC ghi_luot_xem)
│   │       └── LuuTienDo.tsx        (client component ghi tien_do_doc khi mở trang)
│   ├── the-loai/[slug]/page.tsx     (trang lọc truyện theo 1 thể loại)
│   ├── dang-ky/page.tsx             (đăng ký: tên/email/mật khẩu/xác nhận + nút Google)
│   └── dang-nhap/page.tsx           (đăng nhập: email/mật khẩu + nút Google)
├── components/
│   ├── Header.tsx                   (logo + dropdown Thể loại + "Xin chào, {tên}"/đăng xuất hoặc đăng nhập/đăng ký)
│   ├── DropdownTheLoai.tsx          (client component - menu thể loại trong Header)
│   ├── NutDangXuat.tsx              (client component - nút đăng xuất)
│   ├── SearchBox.tsx                (ô tìm kiếm trang chủ)
│   └── TheTruyen.tsx                (thẻ truyện dùng chung - trang chủ + trang thể loại, hiện lượt xem)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                (taoSupabaseClient - Client Component)
│   │   └── server.ts                (taoSupabaseServerClient - Server Component/Action)
│   └── utils/
│       ├── format.ts                (dinhDangSoRutGon - rút gọn số kiểu 12.5K/3.4M)
│       └── dich-loi-supabase.ts     (dichLoiSupabase - dịch lỗi Supabase Auth sang tiếng Việt)
├── scripts/                         (chạy độc lập bằng node --env-file=.env.local)
│   ├── slug.js                      (taoSlug - sinh slug từ tên có dấu)
│   ├── parse-chuong.js              (parseChuong - đọc 1 file chuong-XXX.md)
│   ├── parse-thong-tin.js           (parseThongTin - đọc file thong-tin.md: tác giả/thể loại/mô tả)
│   └── sync-truyen.mjs              (CLI "check [tên truyện]" - đồng bộ chương + metadata lên Supabase)
├── supabase/schema.sql              (schema tích luỹ - áp dụng thủ công qua SQL Editor)
├── __smoke__/smoke.test.ts
├── .env.local.example / .env.local  (biến môi trường; .env.local gitignore)
├── vitest.config.ts / tsconfig.json / package.json
```

## Data model (Supabase Postgres)
- `truyen` — ten, slug, mo_ta, anh_bia (URL Storage), trang_thai, tac_gia, luot_xem.
- `chuong` — truyen_id, so_chuong, tieu_de, noi_dung, luot_xem.
- `tien_do_doc` — user_id, truyen_id, chuong_id (tiến độ đọc, 1 dòng/user/truyện).
- `the_loai` — id, ten, slug.
- `truyen_the_loai` — bảng nối nhiều-nhiều giữa `truyen` và `the_loai`.
- `luot_xem_da_doc` — visitor_key (`nguoidung:<uuid>` hoặc `khach:<uuid cookie>`), chuong_id, PK kép
  — bảng dedup, không cho client đọc/ghi trực tiếp, chỉ qua RPC `ghi_luot_xem`.
- `nguoi_dung` — id (= `auth.users.id`), ten_nguoi_dung, tao_luc. Hồ sơ người dùng riêng biệt với
  `auth.users` (Profile Pattern chuẩn của Supabase), tự tạo qua trigger `khi_co_tai_khoan_moi` mỗi
  khi có tài khoản mới (email/mật khẩu lẫn Google). Nền tảng cho tính năng nạp tiền/mua chương sau
  này — mọi bảng nghiệp vụ về sau nên tham chiếu vào `nguoi_dung.id`, không phải `auth.users` trực
  tiếp.
- Storage bucket `anh-bia` (public) — ảnh bìa từng truyện, tên object = `[slug-truyen].jpg`.

## Auth (Supabase Auth)
- Đăng ký: email/mật khẩu, bắt buộc xác nhận email thật (Supabase "Confirm email" đã bật) + đăng
  nhập Google OAuth.
- Route callback dùng chung `app/auth/callback/route.ts` — nhận `?code=`, `exchangeCodeForSession`,
  redirect `/` (thành công) hoặc `/dang-nhap?loi=xac-nhan-that-bai` (thất bại).
- Google OAuth Client ID/Secret đã cấu hình trên Google Cloud Console + Supabase Dashboard →
  Authentication → Providers → Google.

## Nguồn dữ liệu ngoài (`D:\translate truyen` — dự án này CHỈ ĐỌC, không sửa)
- `danh-sach-truyen/[Tên truyện]/chuong/chuong-XXX.md` — chương đã dịch, dòng đầu
  `# Chương [Số]: [Tiêu đề]`, phần còn lại là nội dung.
- `danh-sach-truyen/[Tên truyện]/thong-tin/thong-tin.md` — dòng `**Tác giả gốc:**`, dòng
  `**Thể loại:**` (tách bằng `/`), mục `## Giới thiệu`.
- `danh-sach-truyen/[Tên truyện]/thong-tin/anh-bia.jpg` — ảnh bìa, được `sync-truyen.mjs` upload
  lên Supabase Storage.

## Lệnh "check [tên truyện]" (chạy khi user gõ trong chat)
`node --env-file=.env.local scripts/sync-truyen.mjs "<tên truyện>"` — đọc chương mới +
metadata (tác giả/thể loại/ảnh bìa/mô tả, ghi đè mỗi lần chạy) từ `D:\translate truyen`, đăng lên
Supabase. Chi tiết hành vi xem `docs/superpowers/specs/2026-09-09-dot-a-metadata-truyen-design.md`.
