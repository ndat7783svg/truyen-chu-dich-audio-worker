# CLAUDE.md

## Mục đích dự án
Website đăng tải các bộ truyện chữ được dịch bằng AI (Trung → Việt), lấy dữ liệu chương từ dự án
dịch riêng biệt tại `D:\translate truyen`. Độc giả vào web đọc truyện; khi user gõ "check [tên bộ
truyện]", Claude vào `D:\translate truyen` kiểm tra chương mới rồi đăng/cập nhật lên đúng bộ truyện
đó trên web.

`D:\translate truyen` là dự án **dịch** (tạo nội dung), độc lập, có `CLAUDE.md` riêng — không sửa
quy tắc dịch ở đó từ dự án này. Dự án này (`website truyện chữ AI`) chỉ **đọc** dữ liệu từ đó rồi
xuất bản lên web, không phải nơi dịch truyện.

## Quy tắc code — LUÔN giao cho Antigravity qua MCP
Mọi việc code (viết tính năng, sửa bug, refactor...) đủ lớn phải giao cho Antigravity qua MCP theo
skill `delegate-antigravity-sk` — Claude đóng vai quản lý (lập plan, duyệt, kiểm tra kết quả thật,
lặp sửa lỗi), không tự code trực tiếp. Ngoại lệ: việc nhỏ/rõ ràng 1-2 bước (sửa vài dòng, đọc/kiểm
tra 1 file) Claude tự làm luôn — xem ngoại lệ trong chính skill đó.

## Quy tắc tự kiểm tra lại trước khi báo "xong" (self code-review)
User tự nhận là "vibecode" — không đọc được code, không thể tự đánh giá qua thuật ngữ kỹ thuật liệu
Claude/Antigravity làm đúng hay sai. Vì vậy **trước khi báo bất kỳ task code nào là hoàn thành**,
Claude phải tự đóng vai 1 kỹ sư phần mềm review lại toàn bộ diff vừa tạo (của chính mình hoặc của
Antigravity) với góc nhìn phản biện — không chỉ đối chiếu "có khớp plan không" mà còn hỏi thật sự
"code này có đúng logic, có bug, có thiếu edge case, có an toàn không". Việc đối chiếu đúng plan
(đã làm sẵn khi giao Antigravity) là bước RIÊNG, không thay thế được bước phản biện kỹ thuật này.

Áp dụng cho mọi task code đủ lớn (không cần cho việc sửa 1-2 dòng rõ ràng). Có thể dùng skill/tool
`code-review` có sẵn trong Claude Code để thực hiện bước này khi phù hợp, thay vì tự đọc lại bằng
mắt thường.

## Kiến trúc đã chốt
- **Next.js (App Router)** + **Vercel** (hosting, domain free `*.vercel.app`) + **Supabase**
  (Postgres DB + Auth) — chọn vì tích hợp DB + đăng ký/đăng nhập trong 1 gói free tier, khớp domain
  Vercel đã chọn, và đã có kinh nghiệm dùng Supabase + Next.js từ project trước.
- Kiến trúc code tổ chức module rõ ràng (core / tính năng / UI) để sau này gắn thêm gói trả phí mua
  chương mà không viết lại từ đầu — nhưng **KHÔNG** tự code phần thanh toán khi chưa được yêu cầu
  rõ ràng.

## Tính năng v1 (đã chốt phạm vi, ưu tiên đơn giản trước)
- Trang chủ: danh sách truyện.
- Trang truyện: thông tin + danh sách chương.
- Trang đọc chương: chỉ hiển thị chữ (chưa làm audio — tạo audio 1 chương rất lâu, chưa cân nhắc).
- Đăng ký / đăng nhập.
- Lưu tiến độ đọc (đọc tiếp từ chương đang dở, cần đăng nhập).
- Tìm kiếm truyện theo tên.
- Dark mode.
- **Hoãn lại, bàn sau:** mục trả phí mua chương; audio trong trang đọc.

## Trạng thái hiện tại
**v1**: **xong hoàn toàn cả 11 Task**, kể cả Task 11 (deploy Vercel) — xem
`docs/superpowers/plans/2026-09-08-website-truyen-v1.md`. (Task 9 đăng ký/đăng nhập đã nâng cấp vượt
phạm vi gốc, Task 10 dark mode gộp vào Đợt C bên dưới — xem 2 mục riêng).

**Đã lên production thật** (2026-09-13): deploy qua Vercel CLI (project `asuo-team/truyen-chu-dich`),
domain riêng **`truyenchudich.site`** (mua trên Namecheap, DNS trỏ A record `76.76.21.21` + CNAME
`www`) đã hoạt động — xác nhận qua browser thật. URL fallback mặc định:
`truyen-chu-dich.vercel.app`. Chi tiết quy trình deploy + domain + các lỗi gặp phải xem
`docs/handoff/deploy-vercel-va-domain.md`.

**Đợt A** (ảnh bìa, tác giả, thể loại, trang chủ/trang truyện nâng cấp — xem spec
`docs/superpowers/specs/2026-09-09-dot-a-metadata-truyen-design.md`, plan
`docs/superpowers/plans/2026-09-09-dot-a-metadata-truyen.md`): **đã xong cả 7 Task + kiểm chứng
thật qua browser + dữ liệu Supabase thật.** `sync-truyen.mjs` giờ tự đọc `thong-tin/thong-tin.md` +
`anh-bia.jpg` bên `D:\translate truyen` mỗi lần "check", không cần nhập tay mô tả nữa.

**Cập nhật 2026-09-13**: `parse-thong-tin.js` giờ đọc thêm field `**Trạng thái:**` ("Hoàn thành"/"Đang
ra") từ `thong-tin.md`, `sync-truyen.mjs` tự ghi vào cột `trang_thai` (Supabase) khi tạo mới lẫn cập
nhật — không còn phải set tay `trang_thai` trong Supabase nữa. Thiếu field này thì giữ nguyên default
DB (`'dang-ra'`) hoặc giá trị hiện có, không ghi đè.

**Đợt B — Phần 1 (lượt xem)**: đã xong Task 1-6 + kiểm chứng thật 4/5 kịch bản — xem spec
`docs/superpowers/specs/2026-09-10-dot-b-luot-xem-design.md`. Phần còn lại (đánh giá sao, "Top
thịnh hành", sidebar "Đọc tiếp") chưa bàn thiết kế.

**Đăng ký/đăng nhập nâng cấp** (Task 9 v1, mở rộng vượt phạm vi gốc — xem spec
`docs/superpowers/specs/2026-09-10-dang-nhap-dang-ky-google-design.md`): **đã xong hoàn toàn**, user
đã tự test đủ 7 kịch bản qua browser thật. Thêm xác nhận email thật, đăng nhập Google OAuth, bảng hồ
sơ `public.nguoi_dung` riêng (không dùng `user_metadata`) làm nền tảng cho tính năng nạp tiền sau
này.

**Đợt C** (thanh điều hướng + trang Tài khoản + theme toàn site — xem spec
`docs/superpowers/specs/2026-09-11-thanh-dieu-huong-tai-khoan-design.md`, plan
`docs/superpowers/plans/2026-09-11-thanh-dieu-huong-tai-khoan.md`): **đã xong hoàn toàn + kiểm
chứng thật qua browser.** Thanh điều hướng icon nổi (Trang chủ/Tài khoản/Tủ truyện), trang Tài
khoản (hồ sơ + đổi theme + đăng xuất), trang Tủ truyện tạm "Sắp ra mắt", theme toàn site 3 chế độ
Sáng/Giấy/Tối (hoàn tất dứt điểm Task 10 dark mode v1). Header bỏ đăng nhập/đăng xuất, chuyển hết
sang trang Tài khoản.

**Tính năng "Đã lưu" (bookmark) + Header full-width** (2026-09-13): **đã xong hoàn toàn + kiểm
chứng thật.** Nút lưu truyện (icon) trên trang truyện, tab "Đã lưu" thật trong Tủ truyện. Header
đổi sang full-width theo mẫu truyendich.ai (logo + Thể loại + tìm kiếm gộp 1 thanh, dùng chung mọi
trang). Tên hiển thị site đổi thành "Truyện chữ dịch".

**Cập nhật truyện + sửa bug thể loại** (2026-09-13): đã cập nhật đủ 4 bộ truyện (Tà Tu Hảo A 510
chương, Phàm Trần Phi Tiên 403, Chôn Vùi Nhân Gian... 266, Sức Mạnh Mỗi Ngày Tăng 1%... 679 —
truyện mới), xác nhận thẳng qua Supabase không thiếu chương nào. Sửa bug thể loại bị gộp sai do
khác dấu phân cách nguồn dịch (`/` vs `,`), mở rộng parser chấp nhận tiêu đề chương không có `#`,
thêm số chương + nhãn "AI" vào thẻ truyện. Chi tiết xem `NEXT_SESSION.md` và
`docs/handoff/cap-nhat-truyen-loi-mang-va-dinh-dang.md`.

**Sửa bug cache ảnh bìa + bug tác giả toàn bộ truyện + thêm bộ truyện thứ 5 + banner fanpage**
(2026-09-13): xem chi tiết ở `NEXT_SESSION.md`. Tóm tắt: `uploadAnhBia` thêm cache-busting `?v=`,
`parseThongTin` sửa đúng nhãn `**Tác giả:**` (trước đó tìm sai nên tác_gia toàn bộ truyện luôn
null/rác), thêm truyện "Mở Đầu Giao Nộp Tu Tiên Giới..." (767 chương), thêm banner mời liên hệ
fanpage Facebook ở đầu trang chủ/trang thể loại (`components/ThongBaoFanpage.tsx`).

**Redesign giao diện mobile-first + chặn copy chương + Vercel Analytics** (2026-09-13): đã xong
hoàn toàn + kiểm chứng thật + deploy production (3 lần deploy trong phiên). Bật Vercel Analytics;
chặn copy nội dung chương mức cơ bản (bôi đen/chuột phải/copy-cut, chỉ trong khối nội dung chương);
redesign 8 Task theo phản hồi thật của user trên điện thoại — thanh điều hướng chuyển xuống đáy
nằm ngang trên mobile (giữ icon nổi dọc trên desktop), ẩn hẳn Header/thanh điều hướng ở trang đọc
chương (thay bằng icon nhà + nút Danh sách chương + nút "Aa", tất cả tự ẩn khi cuộn xuống/hiện lại
khi cuộn lên), nút Chương trước/sau nổi bật, nút "Bắt đầu đọc" + khối "Giới thiệu truyện" thu
gọn/xem thêm ở trang truyện; và 3 fix UX phát sinh sau khi user tự test trên điện thoại thật (thanh
điều hướng dưới đáy che nội dung cuối trang, thêm thanh loading chạy ngang trên cùng khi chuyển
trang + `loading.tsx` cho các route động — xem `docs/handoff/thanh-loading-chuyen-trang.md`). Chi
tiết đầy đủ xem `NEXT_SESSION.md`.

## Giới hạn tốc độ request chống bot cào quá tải — ĐÃ XONG, đã deploy production (2026-09-15)
Rate limit 15 request/10 giây theo IP cho `/truyen/*` (Upstash Redis), bỏ qua hoàn toàn cho
Googlebot/Bing thật (xác minh IP), fail-open khi Upstash lỗi. Đã kiểm chứng thật qua curl dồn dập
trên production. Chi tiết + bug môi trường gặp phải xem `NEXT_SESSION.md`.

## Hệ thống trả phí / Gói VIP (bản thủ công v1) — ĐÃ CODE XONG, chờ user tự test end-to-end
Brainstorm → spec `docs/superpowers/specs/2026-09-13-goi-vip-tra-phi-design.md` → plan
`docs/superpowers/plans/2026-09-13-goi-vip-tra-phi.md` (9 Task, giao Antigravity qua MCP) — build
sạch, 62/62 test pass, đã kiểm chứng qua browser các phần không cần đăng nhập (icon khoá, gate
chương >50, redirect đăng nhập). Phần cần đăng nhập (mua gói, script xác nhận thanh toán) **user tự
test bằng trình duyệt thật** — xem việc cần làm đầu phiên sau trong `NEXT_SESSION.md`.

- Mỗi bộ truyện: 50 chương đầu đọc free, chương sau phải có gói VIP đang hiệu lực.
- 3 gói theo thời gian (kích hoạt gói nào mở toàn bộ mọi truyện không giới hạn chương trong thời
  gian đó): Sơ cấp 1 ngày 6.000đ, Trung cấp 7 ngày 39.000đ (giảm ~7%), Cao cấp 30 ngày 162.000đ
  (giảm ~10%). Mua gói mới **thay thế** hạn cũ (không cộng dồn) — quyết định của user, tránh phiền
  phức quản lý nhiều gói chồng nhau.
- **Thanh toán v1 làm THỦ CÔNG** (PayOS/webhook tự động hoãn sang phiên sau — user chưa có tài
  khoản PayOS, số khách hiện còn ít nên chưa cần tự động hoá ngay): web tạo mã giao dịch
  `VIP-XXXXXX`, user chuyển khoản MoMo cá nhân của chủ site kèm mã đó, chủ site tự đối chiếu rồi
  chạy `node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <mã>` để nâng cấp tài khoản.
- Free-trial 50 chương (không trả tiền từng chương như đa số trang dịch AI khác, ví dụ
  truyendich.ai) — user tự tin chất lượng dịch hơn nhờ duyệt lại 2 lần.

**Việc tiếp theo sau khi user test xong bản thủ công**: tích hợp PayOS để tự động hoá webhook nâng
cấp tài khoản ngay sau khi thanh toán — xem `NEXT_SESSION.md`.

## Quy tắc an toàn khi test
Claude KHÔNG tự bấm submit form đăng ký/đăng nhập thật trên Supabase Auth của user (dù chỉ để
test) — hành động này là "tạo tài khoản", thuộc nhóm bị cấm tuyệt đối theo quy tắc an toàn chung.
Luồng đăng ký/đăng nhập/đăng xuất phải để user tự làm thủ công qua trình duyệt, Claude chỉ hướng
dẫn các bước. Chi tiết xem `docs/handoff/an-toan-thao-tac.md`.

## Các file trong bộ quản lý ngữ cảnh — đọc file nào khi nào
| File | Khi nào mở |
|---|---|
| `PROJECT_MAP.md` | Cần biết code/cấu trúc thư mục nằm ở đâu |
| `HANDOFF.md` (mục lục) → `docs/handoff/*.md` | Cần tra lại 1 quyết định/lỗi/kinh nghiệm cụ thể đã gặp trước đây |
| `NEXT_SESSION.md` | Đầu mỗi phiên mới — biết phiên trước đang làm dở gì, cần đọc **trước** khi hỏi lại user |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
