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
├── middleware.ts                    (rate limit /truyen/* qua Upstash Redis + refresh session Supabase Auth cho user đã đăng nhập (Fast-path bypass cho khách) + cấp cookie khach_id mỗi request)
├── next.config.ts                   (cho phép next/image tải ảnh bìa từ Supabase Storage)
├── app/                             (Next.js App Router)
│   ├── layout.tsx                   (root layout, bọc <ChromeToanSite/> quanh Header+ThanhDieuHuong, <ThanhTienTrinh/> (Suspense), script chống FOUC, metadata.title "Truyện chữ dịch")
│   ├── loading.tsx                  (fallback "Đang tải..." cho route `/`)
│   ├── page.tsx                     (trang chủ - lưới thẻ truyện, đọc query `q` từ URL để lọc theo tìm kiếm)
│   ├── globals.css                  (3 theme CSS Sáng/Giấy/Tối + mapping Tailwind v4 @theme inline + keyframe thanh-tien-trinh)
│   ├── auth/callback/route.ts       (route PKCE dùng chung cho Google OAuth + link xác nhận email)
│   ├── tai-khoan/
│   │   ├── page.tsx                 (trang tài khoản - hồ sơ, cấp độ, mục Gói VIP, đổi theme, đăng xuất)
│   │   └── actions-goi-vip.ts       (server action taoGiaoDich - tạo giao dịch mua gói VIP)
│   ├── tu-truyen/
│   │   ├── page.tsx                 (trang tủ truyện - tab "Đã lưu" thật, query truyen_da_luu join truyen)
│   │   └── DongTruyenDaLuu.tsx      (client - 1 hàng trong danh sách Đã lưu, có nút Bỏ lưu)
│   ├── truyen/[slug]/
│   │   ├── page.tsx                 (trang truyện - ảnh bìa, tác giả, thể loại, mô tả, lượt xem, nút Lưu, nút Bắt đầu đọc/Đọc tiếp, ds chương)
│   │   ├── loading.tsx              (fallback "Đang tải..." cho route trang truyện)
│   │   ├── actions-luu.ts           (server actions luuTruyen/boLuuTruyen cho tính năng Đã lưu)
│   │   ├── NutLuuTruyen.tsx         (client - nút icon bookmark lưu/bỏ lưu, khoá nút lúc đang xử lý)
│   │   ├── MoTaTruyen.tsx           (client - khối "Giới thiệu truyện", line-clamp-4 + toggle Xem thêm/Thu gọn)
│   │   ├── DanhSachChuongTruyen.tsx (client - danh sách chương chia nhóm 50 chương tại chỗ)
│   │   └── chuong/[so]/
│   │       ├── page.tsx             (trang đọc chương - SSR 1 nhóm 50 chương chứa chương đang đọc + tổng số chương + ghi RPC ghi_luot_xem, render KhungDocChuong)
│   │       ├── loading.tsx          (fallback "Đang tải..." cho route trang đọc chương)
│   │       ├── actions-audio.ts     (server action yeuCauTaoAudioNgay - gọi RPC xep_hang_tao_audio và kích hoạt GitHub Actions workflow dispatch)
│   │       ├── KhungDocChuong.tsx   (client - khung đọc, chặn copy nội dung; icon nhà + Aa + Danh sách chương bọc trong 1 khung fixed tự ẩn khi cuộn xuống/hiện khi cuộn lên)
│   │       ├── PanelCaiDatDoc.tsx   (client - nút "Aa" + dropdown 4 mục cài đặt đọc, `absolute` trong khung cha)
│   │       ├── PanelDocAudio.tsx    (client - nút loa "Nghe chương" cạnh "Aa", mở ModalNgheAudioThat hoặc chạy Web Speech API giọng máy)
│   │       ├── ModalNgheAudioThat.tsx (client - modal trình phát audio thật Hoài My Neural, thanh tua 10s, tốc độ đọc, polling trạng thái tạo audio, auto-play, Media Session API)
│   │       ├── DanhSachChuong.tsx   (client - nút "Danh sách" + dropdown chuyển nhóm chương tải on-demand + cache state, `absolute` trong khung cha)
│   │       ├── ChanChuongVip.tsx    (chặn chương >50 khi chưa có gói VIP hiệu lực, hiện <ChonGoiVip/>)
│   │       └── LuuTienDo.tsx        (client component ghi tien_do_doc khi mở trang)
│   ├── the-loai/[slug]/
│   │   ├── page.tsx                 (trang lọc truyện theo 1 thể loại)
│   │   └── loading.tsx              (fallback "Đang tải..." cho route trang thể loại)
│   ├── dang-ky/page.tsx             (đăng ký: tên/email/mật khẩu/xác nhận + nút Google)
│   └── dang-nhap/page.tsx           (đăng nhập: email/mật khẩu + nút Google)
├── components/
│   ├── ChromeToanSite.tsx           (client component - ẩn Header/ThanhDieuHuong theo route, dùng usePathname; ẩn ở trang đọc chương; bọc children trong `pb-16 md:pb-0` để chừa chỗ thanh điều hướng mobile)
│   ├── ThanhTienTrinh.tsx           (client component - thanh progress bar chạy ngang trên cùng khi điều hướng qua `<Link>`, tự viết không dùng thư viện ngoài; chỉ bắt được click `<a>`, không bắt được `router.push()`)
│   ├── ThanhDieuHuong.tsx           (client component - desktop: icon nổi bên trái; mobile (< md): thanh ngang cố định dưới đáy)
│   ├── ChonTheme.tsx                (client component - nút chuyển đổi 3 theme Sáng/Giấy/Tối)
│   ├── Header.tsx                   (thanh header full-width: logo "Truyện chữ dịch" + dropdown Thể loại bên trái, SearchBox bên phải — dùng chung mọi trang)
│   ├── DropdownTheLoai.tsx          (client component - menu thể loại trong Header)
│   ├── NutDangXuat.tsx              (client component - nút đăng xuất, dùng trong trang Tài khoản)
│   ├── SearchBox.tsx                (ô tìm kiếm, nằm trong Header, submit điều hướng về `/?q=...`)
│   ├── TheTruyen.tsx                (thẻ truyện dùng chung - trang chủ + trang thể loại, hiện lượt xem, số chương, nhãn "Dịch")
│   └── ChonGoiVip.tsx               (client - modal chọn 1 trong 3 gói VIP + hướng dẫn chuyển khoản MoMo (QR + tên/ngân hàng/STK có nút copy), dùng chung ở trang Tài khoản và ChanChuongVip)
├── lib/
│   ├── actions/
│   │   └── lay-nhom-chuong.ts       (server action layNhomChuong - tải 50 chương theo nhóm on-demand)
│   ├── config/
│   │   └── goi-vip.ts               (DANH_SACH_GOI 3 gói, SO_CHUONG_FREE=50, layThongTinGoi, THONG_TIN_NHAN_TIEN nhận tiền MoMo)
│   ├── rate-limit/
│   │   └── gioi-han-bot.ts          (layDanhSachIpBotThat, taoRateLimiter - sliding window 15 req/10s qua Upstash Redis)
│   ├── supabase/
│   │   ├── client.ts                (taoSupabaseClient - Client Component)
│   │   └── server.ts                (taoSupabaseServerClient - Server Component/Action)
│   └── utils/
│       ├── theme.ts                 (ThemeToanSite - đọc/ghi theme toàn site qua localStorage)
│       ├── format.ts                (dinhDangSoRutGon - rút gọn số kiểu 12.5K/3.4M)
│       ├── chuong.ts                (tinhSoNhom, tinhNhomCuaChuong, taoDanhSachNhom, catChuongTheoNhom - phân nhóm chương 50)
│       ├── dich-loi-supabase.ts     (dichLoiSupabase - dịch lỗi Supabase Auth sang tiếng Việt)
│       ├── cai-dat-doc.ts           (đọc/ghi cài đặt đọc chương qua localStorage, chuẩn hóa dữ liệu, màu theo theme)
│       ├── cai-dat-audio.ts         (đọc/ghi tốc độ đọc audio qua localStorage; taoDoanDoc - chia nội dung chương thành đoạn ngắn để đọc, né bug Chrome treo utterance dài)
│       ├── gia-han-vip.ts           (tinhHanMoi, conHieuLucGoi, sinhMaGiaoDich - hàm thuần cho gói VIP)
│       └── xac-minh-bot.ts          (layIpTuHeader, ipTrongDaiCidr, ipTrongDanhSach - xác minh IP bot thật)
├── scripts/                         (chạy độc lập bằng node --env-file=.env.local)
│   ├── lib/
│   │   ├── tao-audio-logic.mjs      (hàm thuần/dùng chung cho audio: taoAudioBuffer, uploadVaCapNhat, damBaoBucketStorage, chuanHoaXml, chayPoolSongSong)
│   │   └── tao-audio-logic.test.js  (unit test cho tao-audio-logic)
│   ├── slug.js                      (taoSlug - sinh slug từ tên có dấu)
│   ├── parse-chuong.js              (parseChuong - đọc 1 file chuong-XXX.md, chấp nhận tiêu đề có/không có "#")
│   ├── parse-thong-tin.js           (parseThongTin - đọc file thong-tin.md: tác giả/thể loại/mô tả)
│   ├── kiem-tra-chuong.js           (kiemTraTinhLienTuc/laySoChuongTuTieuDe - kiểm tra thiếu chương/lệch số trong nguồn cục bộ)
│   ├── sync-truyen.mjs              (CLI "check [tên truyện]" - đồng bộ chương + metadata lên Supabase, in báo cáo tính liên tục sau khi đăng)
│   ├── tao-audio-chuong.mjs         (CLI tạo audio file hàng loạt qua msedge-tts giọng vi-VN-HoaiMyNeural, upload bucket audio-chuong, cập nhật chuong.audio_url)
│   ├── worker-audio-chuong.mjs      (Worker CLI quét bảng hang_doi_audio tạo audio ngầm trên máy cá nhân theo chiến lược "tạo trước 1 chương")
│   ├── xac-nhan-thanh-toan-logic.js (tinhHanMoi/SO_NGAY_THEO_GOI/TEN_GOI - hàm thuần dùng cho script CLI dưới, tách riêng khỏi lib/ vì scripts/ là JS thuần không qua TypeScript)
│   └── xac-nhan-thanh-toan.mjs      (CLI xác nhận thanh toán gói VIP thủ công: `node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <MA_GIAO_DICH>`, dùng SUPABASE_SERVICE_ROLE_KEY, idempotent)
├── supabase/schema.sql              (schema tích luỹ - áp dụng thủ công qua SQL Editor)
├── __smoke__/smoke.test.ts
├── .env.local.example / .env.local  (biến môi trường; .env.local gitignore)
├── vitest.config.ts / tsconfig.json / package.json
```

## Data model (Supabase Postgres)
- `truyen` — ten, slug, mo_ta, anh_bia (URL Storage), trang_thai, tac_gia, luot_xem.
- `chuong` — truyen_id, so_chuong, tieu_de, noi_dung, luot_xem, **audio_url** (URL file audio Storage public hoặc null).
- `hang_doi_audio` — chuong_id (PK), truyen_id, so_chuong, yeu_cau_luc, so_lan_loi (hàng đợi tạo audio on-demand "trước 1 chương").
- `tien_do_doc` — user_id, truyen_id, chuong_id (tiến độ đọc, 1 dòng/user/truyện).
- `the_loai` — id, ten, slug.
- `truyen_the_loai` — bảng nối nhiều-nhiều giữa `truyen` và `the_loai`.
- `luot_xem_da_doc` — visitor_key (`nguoidung:<uuid>` hoặc `khach:<uuid cookie>`), chuong_id, PK kép
  — bảng dedup, không cho client đọc/ghi trực tiếp, chỉ qua RPC `ghi_luot_xem`.
- `truyen_da_luu` — nguoi_dung_id, truyen_id, luu_luc, PK kép — bookmark truyện, RLS theo user, ghi
  qua server actions `luuTruyen`/`boLuuTruyen` (`app/truyen/[slug]/actions-luu.ts`).
- `nguoi_dung` — id (= `auth.users.id`), ten_nguoi_dung, tao_luc, **goi_loai, goi_het_han** (thêm
  2026-09-13 cho gói VIP). Hồ sơ người dùng riêng biệt với `auth.users` (Profile Pattern chuẩn của
  Supabase), tự tạo qua trigger `khi_co_tai_khoan_moi` mỗi khi có tài khoản mới (email/mật khẩu lẫn
  Google). Trigger `chan_tu_sua_goi_vip` (before update) chặn user tự sửa `goi_loai`/`goi_het_han`
  qua tài khoản thường — chỉ service role key (script `xac-nhan-thanh-toan.mjs`) mới sửa được.
- `giao_dich` — id, nguoi_dung_id, ma_giao_dich (unique, dạng `VIP-XXXXXX`), goi_loai, so_tien,
  trang_thai (`cho_thanh_toan`/`da_thanh_toan`), tao_luc, thanh_toan_luc — lịch sử mua gói VIP, tạo
  qua server action `taoGiaoDich`, đánh dấu đã thanh toán qua script CLI `xac-nhan-thanh-toan.mjs`.
- Storage bucket `anh-bia` (public) — ảnh bìa từng truyện, tên object = `[slug-truyen].jpg`.
- Storage bucket `audio-chuong` (public) — file audio từng chương, tên object = `[truyen-id]/[so-chuong].mp3`.

## Auth (Supabase Auth)
- Đăng ký: email/mật khẩu, bắt buộc xác nhận email thật (Supabase "Confirm email" đã bật) + đăng
  nhập Google OAuth.
- Route callback dùng chung `app/auth/callback/route.ts` — nhận `?code=`, `exchangeCodeForSession`,
  redirect `/` (thành công) hoặc `/dang-nhap?loi=xac-nhan-that-bai` (thất bại).
- Google OAuth Client ID/Secret đã cấu hình trên Google Cloud Console + Supabase Dashboard →
  Authentication → Providers → Google.

## Cài đặt đọc (chỉ trong trang đọc chương)
- Lưu ở `localStorage` key `caiDatDocTruyen` (không lưu theo tài khoản) — xem
  `lib/utils/cai-dat-doc.ts`.
- 4 mục: màu nền (Sáng/Vàng/Tối), cỡ chữ (16-32px), phông chữ (Hiện đại = mặc định site / Cổ điển
  = Noto Serif), giãn dòng (1.5-2.5). Chi tiết xem
  `docs/superpowers/specs/2026-09-10-cai-dat-doc-chuong-design.md`.

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

## Lệnh tạo audio file hàng loạt
`node --env-file=.env.local scripts/tao-audio-chuong.mjs "<tên truyện>" [--gioi-han-song-song 20]` — tạo
file mp3 Neural TTS (MsEdgeTTS) cho tất cả chương chưa có audio_url, upload Storage `audio-chuong` và
cập nhật DB.

## Lệnh worker tạo audio ngầm (chạy định kỳ Windows Task Scheduler trên máy cá nhân hoặc GitHub Actions)
`node --env-file=.env.local scripts/worker-audio-chuong.mjs [--chuong-id <uuid>]` — ưu tiên tạo audio cho chuong_id (nếu có), sau đó quét tối đa 5 chương trong `hang_doi_audio` (so_lan_loi < 3), tạo audio mp3 và xoá khỏi hàng đợi khi thành công.

