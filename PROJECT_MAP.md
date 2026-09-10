# PROJECT_MAP.md

Bản đồ kiến trúc dự án website đọc truyện (cập nhật sau khi hoàn thành v1 + Đợt A).

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
├── middleware.ts                    (refresh session Supabase Auth mỗi request)
├── next.config.ts                   (cho phép next/image tải ảnh bìa từ Supabase Storage)
├── app/                             (Next.js App Router)
│   ├── layout.tsx                   (root layout, gắn <Header/>)
│   ├── page.tsx                     (trang chủ - lưới thẻ truyện + tìm kiếm)
│   ├── globals.css
│   ├── truyen/[slug]/
│   │   ├── page.tsx                 (trang truyện - ảnh bìa, tác giả, thể loại, mô tả, ds chương)
│   │   └── chuong/[so]/
│   │       ├── page.tsx             (trang đọc chương)
│   │       └── LuuTienDo.tsx        (client component ghi tien_do_doc khi mở trang)
│   ├── the-loai/[slug]/page.tsx     (trang lọc truyện theo 1 thể loại)
│   ├── dang-ky/page.tsx             (đăng ký qua Supabase Auth)
│   └── dang-nhap/page.tsx           (đăng nhập qua Supabase Auth)
├── components/
│   ├── Header.tsx                   (logo + dropdown Thể loại + đăng nhập/đăng ký hoặc nút đăng xuất)
│   ├── DropdownTheLoai.tsx          (client component - menu thể loại trong Header)
│   ├── NutDangXuat.tsx              (client component - nút đăng xuất)
│   ├── SearchBox.tsx                (ô tìm kiếm trang chủ)
│   └── TheTruyen.tsx                (thẻ truyện dùng chung - trang chủ + trang thể loại)
├── lib/supabase/
│   ├── client.ts                    (taoSupabaseClient - Client Component)
│   └── server.ts                    (taoSupabaseServerClient - Server Component/Action)
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
- `truyen` — ten, slug, mo_ta, anh_bia (URL Storage), trang_thai, tac_gia.
- `chuong` — truyen_id, so_chuong, tieu_de, noi_dung.
- `tien_do_doc` — user_id, truyen_id, chuong_id (tiến độ đọc, 1 dòng/user/truyện).
- `the_loai` — id, ten, slug.
- `truyen_the_loai` — bảng nối nhiều-nhiều giữa `truyen` và `the_loai`.
- Storage bucket `anh-bia` (public) — ảnh bìa từng truyện, tên object = `[slug-truyen].jpg`.

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
