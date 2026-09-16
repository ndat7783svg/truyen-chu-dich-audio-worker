# NEXT_SESSION.md

## Phiên 2026-09-16 — hoàn thiện Audio thật (AI): modal, chuyển chương liền mạch, dọn storage

**Đã xong hoàn toàn, đã deploy production, kiểm chứng thật qua browser + GitHub API + Supabase.**
Chi tiết kỹ thuật đầy đủ (bug, nguyên nhân, cách sửa, số liệu đo đạc thật) xem
`docs/handoff/audio-that-ai-modal-va-storage.md` — **đọc file này trước** nếu tiếp tục đụng vào
`ModalNgheAudioThat.tsx`, `KhungDocChuong.tsx`, hoặc `scripts/worker-audio-chuong.mjs`.

Tóm tắt đã làm:
1. Sửa modal bị "đè" (nền không phủ kín, thiếu header/nút X) — nguyên nhân do CSS `transform` của
   ancestor làm `position: fixed` tính sai containing block. Sửa bằng `createPortal` ra
   `document.body`.
2. Sửa mất tiếng khi đóng modal (nút X) — `<audio>` giờ nằm trong portal cố định, không unmount
   theo trạng thái đóng/mở modal.
3. Audio nghe xong tự chuyển chương liền mạch, KHÔNG load lại trang (chữ + audio + URL đều đồng bộ)
   — lấy dữ liệu chương sau qua Supabase client + RPC `lay_noi_dung_chuong` (tự gate VIP), cập nhật
   qua `window.history.replaceState`. Chặn đúng khi chạm ranh giới VIP giữa lúc tự động chuyển.
4. Phát hiện qua GitHub REST API thật: cron `*/5 * * * *` của worker **chưa từng chạy lần nào**
   trong hơn 2 tiếng (hạn chế đã biết của GitHub Actions, không phải lỗi cấu hình) — sửa "mồi trước
   chương sau" từ chỉ ghi hàng đợi sang gọi `yeuCauTaoAudioNgay` (kích hoạt `workflow_dispatch`
   ngay, không phụ thuộc cron).
5. Đo thật: 130 file audio ≈ 1085MB, gần chạm giới hạn Supabase Storage free tier (1GB). Theo yêu
   cầu cụ thể của user: đã **reset sạch** toàn bộ audio cũ trên production + xây cơ chế tự xoá audio
   của CẢ BỘ TRUYỆN nào không ai nghe quá **12 tiếng** (cột `truyen.audio_truy_cap_luc` + RPC
   `ghi_nhan_nghe_audio`, chạy ở đầu mỗi lần worker được kích hoạt thật — không phụ thuộc cron).

**Việc đang treo, CHƯA cần làm ngay**: nếu 1GB Storage vẫn không đủ dù đã dọn 12h (ví dụ traffic
tăng, nhiều truyện cùng có audio), cân nhắc chuyển sang Cloudflare R2 (10GB free + egress miễn phí)
— đã giải thích chi tiết ưu/nhược điểm cho user (thêm tài khoản/API key, sửa lại code
upload/`tao-audio-logic.mjs`, di chuyển file cũ), **user chủ động chọn ở lại Supabase Storage +
cơ chế 12h trước**, chưa chuyển. Không tự ý chuyển sang R2 nếu user không yêu cầu lại.

**Lưu ý khi test/debug tiếp**: script Node dùng `SUPABASE_SERVICE_ROLE_KEY` để thao tác trực tiếp
Storage/DB (list/xoá file, update cột) — chạy bằng `node --env-file=.env.local scripts/<tên>.mjs`
từ thư mục gốc dự án (không phải từ thư mục temp, ESM resolution cần `node_modules` cùng cây thư
mục). Không cố ghi đè `window.fetch` để giả lập response trong browser test — đã thử, supabase-js
dường như giữ tham chiếu `fetch` riêng không bị ghi đè qua cách này, tốn thời gian không hiệu quả.

## Phiên 2026-09-15/16 (tiếp) — tính năng "Nghe chương" + nghiên cứu tạo file audio thật

**Đã xong, đã deploy production**: tính năng "Nghe chương" trong trang đọc (Web Speech API — miễn
phí, đọc trực tiếp bằng giọng trình duyệt, không cần tạo file). Đã sửa 3 bug phát sinh (tự review +
kiểm chứng thật qua browser): chia đoạn tránh Chrome treo, bỏ `pause()/resume()` gốc không đáng tin
cậy, đổi cờ boolean lọc sự kiện cũ sang đánh số thế hệ (generation counter) vì `cancel()` không đảm
bảo luôn bắn sự kiện. Chi tiết đầy đủ + code pattern xem
`docs/handoff/tinh-nang-nghe-chuong-va-nghien-cuu-tts.md`.

**Đã nghiên cứu (CHƯA code) hướng tạo file audio thật** để giải quyết yêu cầu "tắt màn hình vẫn nghe
được" (Web Speech API không làm được, đây là giới hạn nền tảng). Đã benchmark thật `edge-tts` (thư
viện free gọi Neural TTS của Microsoft) với dữ liệu thật:
- Song song 30 chương: 0 lỗi, ~5-8 phút.
- Song song 70 chương: **~53% lỗi**, có chương treo tới 61 phút mới báo lỗi.
- Khuyến nghị mức song song ~20-30 cho batch job thật — truyện 1000 chương ước tính ~3-4 tiếng chạy
  nền. Không có lựa chọn free nào nhanh hơn (model AI mạnh hơn cần GPU riêng, tốn tiền).

**Việc cần làm đầu phiên sau nếu tiếp tục hướng này** — user đã nói "qua chat mới rồi làm tiếp",
CHƯA chốt các quyết định sau, phải hỏi lại trước khi code:
1. File audio thật **thay thế hay bổ sung** nút "Nghe" (Web Speech API) hiện tại?
2. Test thật trên **truyện nào trước** (chọn 1 truyện cụ thể)?
3. Tạo audio **ngay khi "check" chương mới**, hay chạy **hàng loạt cho kho cũ** trước?
4. Lưu ở Supabase Storage (giống ảnh bìa)? Cần kiểm tra giới hạn dung lượng free tier trước khi làm
   hàng loạt (ước tính 1000 chương ≈ 2.5-6GB audio).
- **Lưu ý kỹ thuật khi code thật**: package `msedge-tts` — dùng `toStream()` tự ghi file bằng
  `fs.createWriteStream()`, KHÔNG dùng `toFile()` (không đặt tên file được, luôn ghi đè
  `audio.mp3` cố định — đã gặp bug này lúc test).

## Phiên 2026-09-15 (tiếp) — đăng truyện đã duyệt bên `D:\translate truyen` lên web

Đã làm rõ nghĩa "duyệt" = trạng thái `da_duyet: true` trong `scripts/queue.json` bên
`D:\translate truyen` (Antigravity đã duyệt xong nghĩa/văn phong 1 lô chương). Đã "check" và đăng
lên Supabase (kiểm chứng thật qua Supabase + browser, không chỉ tin log):
- Truyện mới: **Tạo Hóa Thôn Thiên Đỉnh** (709 chương), **Ta Đã Là Đại La Kim Tiên...** (637),
  **Lai Lịch Vô Địch, Ta Vung Đao Chém Chư Thiên** (746), **Mỗi Năm Rút Một Điều Mục, Mô Phỏng Cũng
  Được Sao** (615), **Quốc Thuật - Mỗi Ngày Kết Toán, Bắt Đầu Từ Phu Kéo Xe** (535).
- Cập nhật thêm chương: **Sức Mạnh Mỗi Ngày Tăng 1%, Ta Vô Địch Rồi** 679 → 694 chương.
- Đổi nhãn thẻ truyện "AI" → "Dịch" (`components/TheTruyen.tsx`), đã deploy production.

**Lưu ý quan trọng khi gặp lại cảnh báo "thiếu chương" của `sync-truyen.mjs`/`kiem-tra-chuong.js`
cho truyện "Sức Mạnh Mỗi Ngày Tăng 1%..."**: chương 680 CỐ Ý không tồn tại trong `chuong/` (không
phải lỗi/thiếu thật) — đây là bản dịch dư trùng nội dung với chương 679 (cả 2 dịch cùng 1 chương
gốc do nguồn web chưa ra chương mới lúc dịch), Antigravity đã cố ý loại bỏ để tránh trùng lặp, xem
chi tiết mục "CẬP NHẬT PHIÊN 2026-09-15 (lần 21)" trong `NEXT_SESSION.md` bên `D:\translate truyen`.
Web hiện đúng 694 chương (1-679, 681-695), **không cần dịch lại/fetch lại chương 680**.

## Phiên 2026-09-15 (dài, nhiều sự cố production) — đọc trước khi làm tiếp

Phiên này bắt đầu từ yêu cầu tối ưu tốc độ (danh sách chương dài, chuyển chương chậm), rồi rẽ sang
rà soát bảo mật theo yêu cầu user, dẫn tới sửa lỗi bảo mật nghiêm trọng + 2 lần gây regression sản
xuất thật phải sửa khẩn cấp ngay trong phiên. Tất cả đã sửa xong, đã deploy, đã kiểm chứng lại đầy
đủ qua browser thật + curl trực tiếp Supabase. Xem đầy đủ tại `docs/handoff/hieu-nang-danh-sach-chuong-vercel-region.md`
và `docs/handoff/bao-mat-rls-chan-noi-dung-vip.md`.

**Tóm tắt theo thứ tự đã làm**:
1. Tối ưu hiệu năng: phân trang danh sách chương theo nhóm 50 (trang truyện + dropdown trang đọc
   chương), giảm query nặng khi chuyển chương, bỏ auth-check thừa trong middleware cho khách vãng
   lai — giao Antigravity qua MCP, Claude tự duyệt + kiểm chứng.
2. Vẫn còn chậm sau bước 1 → phát hiện region hàm server Vercel (`iad1`, Mỹ) lệch Supabase
   (Singapore) → thêm `vercel.json` chỉ định `sin1`, TTFB giảm ~2 lần.
3. User gửi 1 bài viết cảnh báo bảo mật, yêu cầu rà soát → tự phát hiện lỗ hổng nghiêm trọng: nội
   dung mọi chương VIP đọc được miễn phí qua Supabase REST API (RLS cũ để hở). Vá bằng SQL 3 lần mới
   đúng (RLS chỉ chặn theo hàng không theo cột — chi tiết đầy đủ trong file handoff).
4. Bản vá bảo mật gây tác dụng phụ: trang chủ + trang thể loại mất trắng ("Không tìm thấy truyện
   nào") vì PostgREST không tương thích quyền cấp-cột với tính năng đếm gộp `chuong(count)` — sửa
   bằng cách tạo VIEW riêng chỉ chứa số đếm.
5. Sau khi ổn định, user báo bị chặn "Bạn thao tác quá nhanh" dù thao tác bình thường → phát hiện
   Next.js tự prefetch mọi `<Link>` hiển thị cộng dồn vào rate limit → sửa middleware bỏ qua request
   prefetch (nhận diện qua header `next-router-prefetch`).

**Trạng thái cuối phiên**: mọi thứ đã deploy production, đã kiểm chứng lại toàn diện (trang chủ,
trang thể loại, trang truyện + danh sách chương chia nhóm, đọc chương free/VIP, lỗ hổng bảo mật đã
đóng, rate limit không còn chặn nhầm). Build sạch, 87/87 test pass tại thời điểm kết thúc phiên.

**Việc CHƯA làm, có thể cân nhắc phiên sau** (không gấp, không ai yêu cầu rõ trong phiên này):
- Vụ giả lượt xem qua gọi thẳng RPC `ghi_luot_xem` (phát hiện cùng lúc rà soát bảo mật) — **user đã
  yêu cầu bỏ qua, không cần làm**.
- Rà soát bảo mật tổng thể vẫn còn các mục cũ chưa làm (xem mục "Việc bảo mật còn lại" phía dưới) —
  lỗ hổng RLS vừa vá là phát hiện MỚI ngoài danh sách cũ đó, không phải cùng 1 việc.
- Sau khi vá RLS bảng `chuong`, nên rà soát nhanh các bảng khác xem có bảng nào khác đang bị lộ dữ
  liệu nhạy cảm qua policy `using (true)` quá rộng tương tự không (chưa làm trong phiên này, chỉ mới
  xử lý đúng bảng `chuong` bị phát hiện).

## Giới hạn tốc độ request chống bot cào quá tải — XONG, đã deploy production (2026-09-15)

Sự cố tối 2026-09-13: 1 bot cào ~60 chương/3 giây làm nghẽn Supabase, gây 404 giả + site chậm cho
khách thật đang đọc. Đã brainstorm → spec `docs/superpowers/specs/2026-09-14-gioi-han-bot-cao-du-lieu-design.md`
→ plan `docs/superpowers/plans/2026-09-14-gioi-han-bot-cao-du-lieu.md` (3 Task, giao Antigravity qua
MCP) → deploy production, kiểm chứng thật qua curl dồn dập.

- Rate limit **15 request/10 giây theo IP**, chỉ áp dụng `/truyen/*` (trang truyện + trang đọc
  chương) — vượt ngưỡng trả 429 ngay, không gọi Supabase. Dùng Upstash Redis (free tier, region
  Singapore) để đếm dùng chung giữa các server function Vercel.
- Googlebot/Bing **thật** (xác minh bằng đối chiếu IP với danh sách IP chính thức, cache 24h) được
  **bỏ qua hoàn toàn** giới hạn — không ảnh hưởng SEO. Giả danh User-Agent "Googlebot" mà IP không
  khớp vẫn bị giới hạn bình thường.
- Lỗi Upstash (hết quota, mất kết nối) → fail-open, không làm sập site.
- **Bug phát sinh khi kiểm chứng đã tự sửa**: sau khi code xong, test dồn dập 20 request đều ra
  200, không hề có 429 nào — tra thẳng bằng debug tạm trong middleware phát hiện nguyên nhân thật:
  user dán giá trị `UPSTASH_REDIS_REST_URL` vào Vercel Environment Variables **kèm dấu ngoặc kép
  thừa** (`"https://..."` thay vì `https://...`), khiến Upstash Redis client từ chối kết nối, code
  tự fail-open (đúng thiết kế an toàn) nên im lặng cho qua hết. User tự sửa lại giá trị đúng trên
  Vercel Dashboard, xoá dấu ngoặc kép, deploy lại là hết. Bài học: khi 1 tính năng cần biến môi
  trường mới hoàn toàn không hoạt động dù code đúng plan, nghi ngay giá trị biến môi trường (dấu
  ngoặc kép/khoảng trắng thừa khi dán) trước khi nghi logic code — thêm 1 nhánh debug tạm trả lỗi
  thật ra response (chỉ khi có query param riêng, xoá ngay sau khi xác định xong) là cách nhanh
  nhất để thấy lỗi thật từ môi trường serverless, thay vì đoán.
- Đã kiểm chứng thật qua curl dồn dập trên production: 15/20 request qua, 5 request bị 429; tự mở
  lại sau 10 giây; trang chủ (không thuộc `/truyen/*`) hoàn toàn không bị ảnh hưởng.
- Việc còn lại của mối lo bảo mật cũ (xem mục cũ bên dưới): mục 2 "chặn copy nâng cao" và mục 4 "rà
  soát bảo mật tổng thể" vẫn chưa làm — mục 3 coi như đã giải quyết phần cốt lõi (giảm tải do bot)
  qua việc này, dù cách tiếp cận khác 1 chút (giới hạn theo IP thay vì chỉ lọc User-Agent).

## Hệ thống gói VIP (bản thủ công v1) — code xong, CHỜ USER TỰ TEST end-to-end (2026-09-13)

Brainstorm → spec `docs/superpowers/specs/2026-09-13-goi-vip-tra-phi-design.md` → plan 9 Task
`docs/superpowers/plans/2026-09-13-goi-vip-tra-phi.md` → giao Task 2-8 cho Antigravity qua MCP
(Claude tự duyệt diff từng Task, đúng plan 100%), Task 1 (SQL) + phần chữ/nút copy thông tin chuyển
khoản Claude tự làm (việc nhỏ). Build sạch, 62/62 test pass.

**Quyết định quan trọng nhất**: PayOS/webhook tự động **hoãn sang phiên sau** — user chưa có tài
khoản PayOS, số khách hiện tại còn ít nên chưa cần tự động hoá ngay. v1 làm thủ công: web tạo mã
giao dịch `VIP-XXXXXX`, user chuyển khoản MoMo cá nhân của chủ site kèm mã đó trong nội dung, chủ
site tự đối chiếu rồi chạy script CLI để nâng cấp tài khoản.

- 3 gói: Sơ cấp 1 ngày 6.000đ, Trung cấp 7 ngày 39.000đ, Cao cấp 30 ngày 162.000đ — mua gói mới
  **thay thế** hạn cũ (không cộng dồn), hết hạn tính theo giờ chính xác.
- 50 chương đầu mỗi truyện free; truyện mới ít hơn 50 chương thì free toàn bộ.
- Gate chương >50: chưa đăng nhập → redirect `/dang-nhap`; đã đăng nhập nhưng chưa có gói hiệu lực →
  hiện `ChanChuongVip` (không lộ `noi_dung` trong HTML).
- Trigger DB `chan_tu_sua_goi_vip` chặn user tự sửa `goi_loai`/`goi_het_han` qua tài khoản thường —
  phát sinh ngoài spec gốc, cần thiết vì policy update hồ sơ sẵn có cho phép user tự sửa hồ sơ mình.
- Script `scripts/xac-nhan-thanh-toan.mjs <MA_GIAO_DICH>` (dùng `SUPABASE_SERVICE_ROLE_KEY`) — idempotent,
  chạy lại với mã đã xử lý sẽ báo "đã xử lý trước đó", không nâng hạn thêm lần nữa.
- Đã cắt ảnh QR nhận tiền MoMo thật của user từ ảnh chụp màn hình (`ffmpeg`) lưu vào
  `public/qr-nhan-tien-momo.png`, đồng thời thêm khối thông tin dạng chữ (tên người nhận/ngân
  hàng/số tài khoản) kèm nút Copy trong modal `ChonGoiVip.tsx` — user yêu cầu giữa phiên, ngoài phạm
  vi plan gốc (chỉ có ảnh QR), Claude tự làm trực tiếp (việc nhỏ).

**Kiểm chứng đã làm được qua browser (Claude tự làm, không cần đăng nhập)**: icon khoá đúng ở chương
>50 trong danh sách chương trang truyện; chương ≤50 đọc bình thường không bị chặn; vào thẳng URL
chương >50 khi chưa đăng nhập → redirect đúng `/dang-nhap`; console sạch lỗi (tab trình duyệt mới
hoàn toàn — 1 tab cũ trong phiên bị kẹt "Đang tải..." do dùng chung dev server với phiên chat khác,
xác nhận qua `curl` thẳng vào server là false alarm, không phải bug thật).

**Việc CHƯA kiểm chứng được (cần đăng nhập, Claude không tự đăng nhập tài khoản thật theo quy tắc an
toàn `docs/handoff/an-toan-thao-tac.md`) — USER TỰ TEST bằng trình duyệt thật, đây là việc đầu tiên
cần làm ở phiên sau nếu chưa test xong**:
1. Đăng nhập → vào `/tai-khoan`, xác nhận mục "Gói VIP" hiện đúng "Chưa có gói VIP đang hiệu lực".
2. Bấm "Mua gói VIP" → chọn 1 gói → xác nhận modal hiện đúng mã `VIP-XXXXXX`, số tiền, ảnh QR, và
   khối thông tin chuyển khoản (tên/ngân hàng/STK) copy được.
3. Tự chuyển khoản thật (hoặc bỏ qua bước chuyển tiền, chỉ cần có mã) rồi chạy:
   `node --env-file=.env.local scripts/xac-nhan-thanh-toan.mjs <mã vừa tạo>` — xác nhận script in
   đúng tên user, tên gói, hạn mới.
4. F5 lại `/tai-khoan` và trang chương >50: xác nhận gói đã kích hoạt, đọc được chương >50, icon
   khoá biến mất ở trang truyện.
5. Chạy lại script với cùng mã lần 2: xác nhận báo "đã xử lý trước đó", không nâng hạn thêm.
6. **Trước khi test thật**: nhớ chạy phần SQL mới cuối `supabase/schema.sql` qua Supabase Dashboard
   nếu chưa chạy (cột `goi_loai`/`goi_het_han`, bảng `giao_dich`, trigger) — đã nhắc nhưng ghi lại
   để chắc chắn.

**Sau khi user xác nhận test xong (dù pass hay có bug)**, việc tiếp theo là PayOS/webhook tự động —
xem `CLAUDE.md` mục "Kế hoạch tiếp theo".

## Chốt phiên 2026-09-13 (dài) — chuyển sang chat mới, đọc mục này trước tiên

Phiên này làm liên tục nhiều việc, đã **deploy production 3 lần**, lần cuối cùng gồm đủ mọi thay
đổi. Thứ tự thực tế đã làm (các mục chi tiết bên dưới, đọc theo thứ tự ngược từ đây xuống nếu cần
tra lại kỹ):

1. Bật Vercel Analytics (`@vercel/analytics`) — deploy lần 1.
2. Phát hiện lượt xem tăng bất thường sau khi có domain thật → **không phải bug**, là bot
   Googlebot/Bing crawl lần đầu (dedup theo `visitor_key` vẫn đúng, chỉ là bot không giữ cookie nên
   mỗi lần bị tính "khách mới").
3. User lo ngại bị "ăn cắp truyện" → đã tách thành 4 việc bảo mật độc lập, **mới làm xong việc 1**:
   - [x] Chặn copy nội dung chương (mức cơ bản: bôi đen/chuột phải/copy-cut, chỉ trong khối nội
         dung chương, không ảnh hưởng SEO).
   - [ ] Chặn copy nâng cao (rate limit IP, CAPTCHA, obfuscate DOM chống scraper) — **user yêu cầu
         để dành phiên sau**, chưa brainstorm.
   - [ ] Chặn bot làm sai lệch lượt xem (lọc User-Agent trước khi gọi RPC `ghi_luot_xem`, KHÔNG
         được chặn crawl của Googlebot/Bing vì cần cho SEO).
   - [ ] Rà soát bảo mật tổng thể (auth, RLS Supabase, secrets, API) — việc lớn nhất, nên dùng
         skill `security-review` hoặc brainstorm kỹ, chưa động vào.
4. Redesign giao diện mobile-first (8 Task, xem mục riêng bên dưới) — deploy lần 2.
5. User tự test trên điện thoại thật, báo thêm 3 vấn đề UX → đã sửa cả 3 (xem mục riêng bên dưới)
   — deploy lần 3 (**mới nhất**, đã lên production, CHƯA có phản hồi test lại từ user**).

**Việc cần làm ngay đầu phiên mới**: hỏi user đã test lại 3 fix UX mới nhất trên điện thoại thật
chưa (đặc biệt thanh loading chạy ngang khi bấm thẻ truyện/tên chương) — nếu chưa ổn, xem
`docs/handoff/thanh-loading-chuyen-trang.md` trước khi sửa tiếp (đã ghi rõ giới hạn đã biết: không
bắt được điều hướng qua `router.push()` ở ô tìm kiếm/đăng nhập/đăng xuất).

**Sau đó**: ưu tiên số 1 vẫn là hệ thống trả phí/VIP (xem `CLAUDE.md` mục "Kế hoạch tiếp theo") —
bắt buộc `brainstorming` trước khi code.

## 3 fix UX từ phản hồi test thật trên điện thoại (2026-09-13, sau redesign) — xong, đã deploy

User dùng `ask-before-do` yêu cầu xác nhận hiểu đúng trước khi sửa (Claude đã hỏi lại + xác nhận
từng điểm trước khi code, không tự đoán). Vì là sửa lỗi trên code đã duyệt (không phải tính năng
mới), Claude tự code trực tiếp, không qua Antigravity.

- [x] **Icon trang đọc chương che chữ khi cuộn**: 3 nút (nhà/Danh sách/Aa) trong
      `KhungDocChuong.tsx` giờ bọc chung 1 khung `fixed` có `transition-transform`, tự trượt lên ẩn
      khi cuộn xuống > 80px, trượt xuống hiện lại ngay khi cuộn lên (theo dõi hướng cuộn bằng
      `scrollYTruocRef`). `DanhSachChuong.tsx`/`PanelCaiDatDoc.tsx` đổi từ `fixed` sang `absolute`
      (nằm trong khung fixed cha thay vì tự fixed riêng).
- [x] **Thanh điều hướng dưới đáy che nội dung cuối trang** (mobile): `ChromeToanSite.tsx` bọc
      `children` (ở các trang không phải trang đọc chương) trong `<div className="pb-16 md:pb-0">`
      để chừa chỗ cho thanh điều hướng cố định.
- [x] **Không có thanh loading khi chuyển trang** (ban đầu Claude chẩn đoán sai là do prefetch quá
      nhiều gây nghẽn — user sửa lại: vấn đề là thiếu phản hồi trực quan, không phải chậm). Đã thêm
      `components/ThanhTienTrinh.tsx` (progress bar chạy ngang trên cùng, không dùng thư viện
      ngoài) + `loading.tsx` cho 4 route động (`/`, `/truyen/[slug]`,
      `/truyen/[slug]/chuong/[so]`, `/the-loai/[slug]`) — đúng theo tài liệu Next.js 16 chính thức
      xác định "route động thiếu `loading.tsx`" là nguyên nhân chính xác của triệu chứng này. Chi
      tiết đầy đủ + giới hạn đã biết xem `docs/handoff/thanh-loading-chuyen-trang.md`.
- Build sạch, 52/52 test pass. Đã deploy production (lần 3, mới nhất).

## Redesign giao diện mobile-first (2026-09-13): xong hoàn toàn 8/8 Task + kiểm chứng thật

User chủ yếu đọc trên điện thoại, phản hồi 6 vấn đề UX qua ảnh chụp thật (thanh điều hướng đè
chữ, Header thừa trong trang đọc, bug vị trí nút Aa, thiếu nút bắt đầu đọc/danh sách chương, mô tả
truyện không có cấu trúc). Brainstorm (dùng skill `ask-before-do` xác nhận hiểu đúng ý trước khi
làm) → spec `docs/superpowers/specs/2026-09-13-redesign-mobile-doc-truyen-design.md` → plan 8 Task
`docs/superpowers/plans/2026-09-13-redesign-mobile-doc-truyen.md` → giao từng Task cho Antigravity
qua MCP, Claude tự duyệt diff + build/test + kiểm chứng qua Browser pane (resize 375px/320px) sau
mỗi Task trước khi sang Task kế — **cả 8 Task đều xong, không Task nào bị bỏ dở.**

- [x] Task 1: `ChromeToanSite.tsx` — ẩn Header/ThanhDieuHuong ở trang đọc chương theo route.
- [x] Task 2: `ThanhDieuHuong.tsx` responsive — thanh ngang dưới đáy trên mobile, giữ icon nổi dọc
      trên desktop.
- [x] Task 3: Icon nhà + nút Aa `fixed` trong trang đọc chương, sửa bug đè chữ (phát hiện qua
      browser thật, agy làm đúng theo plan nhưng thiếu `pt-14` cho `<main>` — Claude tự thêm sau
      khi thấy đè chữ trên viewport 375px).
- [x] Task 4: Nút "Danh sách chương" dropdown tại chỗ, cuộn được, tô đậm chương đang đọc.
- [x] Task 5: Nút Chương trước/sau đổi thành nút có viền, cao 44px (chuẩn touch target).
- [x] Task 6: Nút "Bắt đầu đọc" ở trang truyện, cạnh nút "Đọc tiếp" (nếu có tiến độ).
- [x] Task 7: Khối "Giới thiệu truyện" tách riêng, line-clamp-4 + toggle Xem thêm/Thu gọn.
- [x] Task 8: Kiểm chứng tổng thể — build sạch, 52/52 test pass, console sạch (xác nhận qua tab
      trình duyệt mới hoàn toàn, không tính nhiễu HMR ở tab cũ đã trải qua nhiều lần restart dev
      server), desktop giữ nguyên layout cũ (không hồi quy).

**Sự cố hạ tầng gặp giữa chừng (không phải lỗi code Task 5)**: sau nhiều lần gọi `npm run build`
liên tiếp song song với `next dev` đang chạy trên cùng thư mục `.next`, dev server bị lỗi 404 toàn
bộ route động. Đã xử lý: kill process cũ + xoá `.next` + khởi động lại qua `preview_start`. Sau đó
phát hiện thêm nguyên nhân thật khiến chậm là **WARP bị tắt** (lặp lại sự cố đã ghi ở
`docs/handoff/moi-truong-va-cong-cu.md`) — user bật lại WARP là hết. Bài học mới: tránh chạy
`npm run build` nhiều lần liên tục khi có `next dev` đang chạy cùng thư mục dự án — cân nhắc chỉ
chạy build 1 lần ở cuối (Task 8) thay vì sau mỗi Task, hoặc dùng thư mục `.next` khác cho build tạm
nếu cần kiểm tra type giữa chừng thường xuyên.

**Đã deploy lên production** ngay sau đó (cùng phiên, gộp chung với việc chặn copy chương ở mục
dưới) — xem mục "Chốt phiên 2026-09-13" ở đầu file để biết thứ tự deploy đầy đủ.

## Bật Vercel Analytics + chặn copy nội dung chương (2026-09-13)

- **Bật Vercel Analytics**: cài `@vercel/analytics`, thêm `<Analytics/>` vào `app/layout.tsx`. Đã
  deploy production (`npx vercel --prod --yes`), xem số liệu tại Vercel Dashboard → Analytics.
- **Phát hiện bot crawl mạnh sau khi có domain thật**: tra `luot_xem_da_doc` bằng service role key
  thấy chỉ trong ~19 phút có 7 cookie khách đọc gần 1000 chương (1 cookie đọc 254 chương liên tiếp,
  cách nhau 1-2 giây) — không phải lỗi đếm trùng, cơ chế dedup vẫn đúng, chỉ là bot không giữ cookie
  nên mỗi lần bị tính "khách mới". Khả năng là Googlebot/Bing index trang mới, chưa chắc là ăn cắp
  nội dung.
- **Chặn copy nội dung chương (mức cơ bản, đã xong)**: brainstorm → spec
  `docs/superpowers/specs/2026-09-13-chan-copy-noi-dung-chuong-design.md` → Claude tự code (việc
  nhỏ 1 file) → kiểm chứng qua browser thật (dispatch event `contextmenu`/`copy` bị chặn đúng trong
  `<article>`, nhưng vẫn cho phép ở phần tử khác ngoài phạm vi). `user-select: none` +
  `onContextMenu`/`onCopy`/`onCut` chặn trong `KhungDocChuong.tsx`, chỉ áp dụng khối nội dung
  chương, không ảnh hưởng SEO (nội dung vẫn text thật trong DOM). Build + 52/52 test pass, đã
  commit — **CHƯA deploy lên production** (user sắp hết giới hạn token tuần, để dành phiên sau).

## Việc bảo mật còn lại — làm ở phiên sau (theo thứ tự đã bàn với user)
User lo ngại bị "ăn cắp truyện" sau khi thấy lượt xem tăng bất thường (thực ra là bot, xem trên).
Đã tách thành 3 việc độc lập, mới làm xong việc 1 (bản cơ bản):
1. ~~Chặn copy nội dung chương (mức cơ bản)~~ — xong, xem trên.
2. **Chặn copy nâng cao** (user yêu cầu để dành lần sau): rate limit theo IP, CAPTCHA khi nghi
   ngờ, obfuscate DOM để scraper tự động khó cào hàng loạt — cần cân nhắc kỹ vì có thể ảnh hưởng
   SEO/trải nghiệm đọc thật, phải brainstorm riêng.
3. **Chống bot đọc trang** (làm sai lệch lượt xem) — cân nhắc: lọc theo User-Agent chứa
   bot/crawler/spider trước khi gọi RPC `ghi_luot_xem`, nhưng KHÔNG được chặn hẳn Googlebot/Bing
   truy cập trang (cần cho SEO) — chỉ nên loại chúng khỏi việc đếm lượt xem, không chặn crawl.
4. **Rà soát bảo mật tổng thể** (auth, RLS Supabase, secrets, API) — việc lớn nhất, nên làm dạng
   audit riêng, dùng skill `security-review` hoặc brainstorm kỹ trước khi động vào.

## Deploy production + mua domain + thêm truyện mới + banner fanpage (2026-09-13)

- **Thêm bộ truyện thứ 5** "Mở Đầu Giao Nộp Tu Tiên Giới, Quốc Gia Cho Ta Thành Tiên Trước" — 767/767
  chương, không thiếu chương nào, tác giả "Củ Hành Xinh Đẹp" (parse đúng nhờ đã sửa bug tác giả).
- **Thêm trạng thái "Hoàn thành"** cho "Chôn Vùi Nhân Gian Trở Về..." — đọc từ field `**Trạng
  thái:**` mới thêm vào `thong-tin.md`, `parse-thong-tin.js`/`sync-truyen.mjs` đã hỗ trợ sẵn (tự
  thêm hàm `timTrangThai`, xem code hiện tại — phần này được thêm ngoài phiên chat, không phải
  Claude tự viết trong lượt hội thoại, chỉ chạy sync để áp dụng).
- **Thêm banner mời liên hệ fanpage Facebook** ở đầu trang chủ + trang thể loại
  (`components/ThongBaoFanpage.tsx`) — icon Facebook + link tới fanpage, mời độc giả liên hệ khi
  muốn dịch truyện mới hoặc gặp sự cố. Build + 49/49 test pass lúc đó.
- **Kiểm tra tổng thể website trước deploy**: build sạch, 52/52 test pass, duyệt qua browser thật
  tất cả luồng chính (trang chủ, trang truyện, đọc chương, tìm kiếm, tài khoản, tủ truyện, 404) —
  không lỗi console (lỗi HMR/parse hiện trong tab cũ chỉ là artifact, tab mới sạch hoàn toàn).
- **Deploy Vercel + mua domain Namecheap: XONG, đã lên production thật** — quy trình đầy đủ + các
  bug gặp phải (stdin bị lệch khi set env vars, WARP chặn IP Vercel, lỗi UI Namecheap khi xoá DNS
  record) xem chi tiết `docs/handoff/deploy-vercel-va-domain.md`. Tóm tắt kết quả:
  - Project Vercel: `asuo-team/truyen-chu-dich`.
  - Domain chính thức: **truyenchudich.site** (mua $0.98/năm, đã tắt auto-renew theo yêu cầu user).
  - Domain đã trỏ đúng, xác nhận chạy tốt qua browser thật của user.
- User xác nhận: sau session này muốn brainstorm + code hệ thống **trả phí / tài khoản VIP** — xem
  mục kế hoạch trong `CLAUDE.md` (đã ghi ý tưởng ban đầu của user, CHƯA chốt thiết kế, phải
  brainstorm kỹ trước).

## Sửa ảnh bìa không cập nhật (cache) + bug tác giả bị null/rác toàn bộ truyện (2026-09-13)

- **Đổi ảnh bìa "Tà Tu Hảo A..."** theo ảnh mới user cung cấp (dán trực tiếp trong chat, không có
  đường dẫn file — user phải lưu ra ổ đĩa rồi cho đường dẫn). Convert PNG → JPG thật bằng `ffmpeg`
  (không chỉ đổi đuôi file) trước khi ghi đè `thong-tin/anh-bia.jpg`.
- **Bug cache ảnh bìa không cập nhật (đã sửa)**: sau khi `sync-truyen.mjs` upload ảnh mới lên
  Supabase Storage (upsert cùng tên file `<slug>.jpg`), ảnh mới **không hiện** trên web dù đã hard
  reload / incognito / restart hẳn dev server — vì Next.js Image cache biến thể WebP/AVIF theo
  đúng URL, mà URL ảnh bìa luôn giữ nguyên tên nên không có tín hiệu nào báo ảnh đã đổi. Xác nhận
  qua nhiều lớp: curl thẳng vào Next.js image endpoint luôn đúng ảnh mới, nhưng `<img>` trên trang
  (mọi trình duyệt, kể cả incognito) vẫn hiện ảnh cũ — chỉ hết khi đổi hẳn URL. **Đã sửa tận gốc**:
  `uploadAnhBia` trong `scripts/sync-truyen.mjs` giờ tự thêm hậu tố `?v=<timestamp>` vào URL ảnh bìa
  mỗi lần sync, buộc trình duyệt/Next.js luôn coi là ảnh mới hoàn toàn. Bài học: ảnh dùng tên file cố
  định + `upsert: true` sẽ luôn dính lỗi cache kiểu này ở production thật (Vercel/CDN), không chỉ dev
  — nên bắt buộc phải có cache-busting cho mọi URL ảnh có thể bị thay thế sau này (không riêng ảnh
  bìa), tránh lặp lại phải debug nhiều lớp như lần này.
- **Bug tác giả (`tac_gia`) luôn null hoặc rác — ảnh hưởng TẤT CẢ bộ truyện, không riêng 1 bộ**:
  `parseThongTin` tìm nhãn `**Tác giả gốc:**` nhưng mọi file `thong-tin.md` thật đều dùng nhãn
  `**Tác giả:**` (không có "gốc") — regex không bao giờ khớp, nên `tac_gia` luôn `null` và
  `sync-truyen.mjs` (`if (thongTin.tacGia) capNhat.tac_gia = ...`) không bao giờ ghi đè giá trị cũ
  trong DB dù chạy sync lại bao nhiêu lần. Bộ "Tà Tu Hảo A..." bị lộ ra vì DB đã lỡ có sẵn giá trị
  rác `生態撕裂獸l-27型` từ trước (nguồn gốc không rõ, có thể nhập tay khi tạo truyện). Đã sửa
  `scripts/parse-thong-tin.js` khớp đúng nhãn `**Tác giả:**` + tự bỏ phần tên Hán trong ngoặc (giống
  cách xử lý thể loại) — TDD, cập nhật test cũ dùng nhãn sai + thêm 1 test mới cho việc bỏ ngoặc.
  Chạy lại sync cho cả 4 bộ để điền đúng tác giả tiếng Việt. 49/49 test pass.

## Sửa bug thể loại bị gộp sai + thêm số chương/nhãn AI vào thẻ truyện (2026-09-13)

- **Bug phát hiện**: `parseThongTin` chỉ tách thể loại theo dấu `/`, nhưng 3 bộ mới cập nhật dùng
  dấu phẩy `,` — khiến cả cụm thể loại bị gộp thành 1 the_loai duy nhất (tên dài lằng nhằng). Đã sửa
  `scripts/parse-thong-tin.js` chấp nhận cả `/` và `,` (TDD, 3 test mới). Đã viết script dọn dữ liệu
  cũ bị gộp sai trong Supabase (xoá 4 dòng `the_loai` lỗi + 4 liên kết `truyen_the_loai`), sau đó
  chạy lại `sync-truyen.mjs` cho cả 3 bộ để gán lại đúng thể loại tách riêng.
- **Thêm mới thẻ truyện** (`components/TheTruyen.tsx` + query `app/page.tsx` và
  `app/the-loai/[slug]/page.tsx`): hiện số chương (qua Supabase embedded count `chuong(count)`) và
  nhãn "AI" màu tím góc phải trên ảnh bìa (báo cho độc giả biết truyện dịch bằng AI).
- Đã thêm thành công truyện mới "Sức Mạnh Mỗi Ngày Tăng 1%, Ta Vô Địch Rồi" (679 chương, ảnh bìa
  phải đổi tên đúng `anh-bia.jpg` mới nhận diện được — file gốc user lưu tên khác `.png`).
- Kiểm chứng qua browser: trang chủ + trang thể loại đều hiện đúng thể loại tách riêng, số chương,
  nhãn AI. Console sạch lỗi. Build + 48/48 test pass.

## Cập nhật 3 bộ truyện + mở rộng `sync-truyen.mjs` kiểm tra tính liên tục số chương (2026-09-13)

Lệnh "check [tên truyện]" chạy cho 3 bộ: Tà Tu Hảo A - Tà Tu Thăng Cấp Khoái, Phàm Trần Phi Tiên,
Chôn Vùi Nhân Gian Trở Về - Ta Tạo Phản Ngươi Hoảng Cái Gì. Cả 3 đã đăng đủ chương, xác nhận thẳng
qua Supabase (không chỉ tin log script) — không thiếu chương nào:
- Tà Tu Hảo A, Tà Tu Thăng Cấp Khoái: 510/510 chương.
- Phàm Trần Phi Tiên: 403/403 chương.
- Chôn Vùi Nhân Gian Trở Về, Ta Tạo Phản Ngươi Hoảng Cái Gì: 266/266 chương (truyện mới).

**Sự cố phát sinh & đã xử lý xong**:
1. **WARP bị ngắt kết nối** giữa chừng → hàng loạt chương bị lỗi "fetch failed" khi đang đăng (ISP
   chặn domain supabase.com khi không có WARP, đã ghi ở `moi-truong-va-cong-cu.md`). User tự bật lại
   WARP, Claude chạy lại lệnh sync — script tự bỏ qua chương đã có, chỉ đăng nốt phần thiếu (idempo-
   tent). Phát hiện thêm: 1 chương ("Phàm Trần Phi Tiên" chương 134) báo lỗi fetch nhưng thực ra đã
   đăng thành công (request tới server OK, phản hồi bị rớt do mạng chập chờn) — lần chạy lại tự nhận
   ra đã có nên bỏ qua, không đăng trùng. Bài học: log "loi fetch" khi đang cập nhật hàng loạt không
   đồng nghĩa 100% chương đó thực sự thiếu trên DB — luôn xác nhận lại bằng truy vấn DB thật (service
   role key) sau khi nghi ngờ, đừng chỉ dựa vào danh sách "bỏ qua" của lần chạy có lỗi mạng.
2. **"Chôn Vùi Nhân Gian..." toàn bộ 266 file không parse được** — nguồn dịch xuất chương thiếu dấu
   `#` ở đầu dòng tiêu đề (khác 2 bộ kia). User quyết định: nới luật parse chấp nhận cả 2 định dạng
   thay vì sửa lại nguồn dịch. Đã sửa `scripts/parse-chuong.js` (TDD, test mới cho định dạng không có
   `#`) — không đổi hành vi cũ cho file có `#`, chỉ thêm nhánh chấp nhận dòng `Chương N: ...` trần.

**Tính năng mới thêm vào `sync-truyen.mjs`** (theo yêu cầu user, áp dụng từ nay mỗi lần "check"):
sau khi đăng chương xong, script tự in báo cáo kiểm tra tính liên tục số chương nguồn (module mới
`scripts/kiem-tra-chuong.js`, TDD 6/6 test): liệt kê số chương bị thiếu trong khoảng
[min-max] của các file cục bộ, và cảnh báo nếu số chương ghi trong tiêu đề nội dung khác với số
trong tên file (nghi trùng/nhầm số). Lưu ý: báo cáo này kiểm tra **nguồn file cục bộ**, không phải
tình trạng đã đăng lên DB — 2 việc khác nhau, xem mục sự cố (1) ở trên.

## Tính năng "Đã lưu" (bookmark truyện) + Header full-width: xong hoàn toàn + kiểm chứng thật

Brainstorm → spec `docs/superpowers/specs/2026-09-13-da-luu-truyen-design.md` → plan
`docs/superpowers/plans/2026-09-13-da-luu-truyen.md` → giao Antigravity thực thi Task 1-4 → Claude
tự kiểm chứng qua browser thật + đọc lại code + tự sửa bug phát sinh.

- [x] Bảng `truyen_da_luu` (nguoi_dung_id, truyen_id, luu_luc), RLS theo user — user đã tự chạy SQL
      qua Supabase Dashboard.
- [x] Server actions `luuTruyen`/`boLuuTruyen` (`app/truyen/[slug]/actions-luu.ts`).
- [x] Nút Lưu trên trang truyện (`NutLuuTruyen.tsx`) — icon bookmark (không phải chữ, theo yêu cầu
      user), khoá nút trong lúc chờ xử lý (chống bấm đúp gây race condition).
- [x] Tab "Đã lưu" thật trong `/tu-truyen` (`DongTruyenDaLuu.tsx`) — danh sách hàng ngang, mới lưu
      lên đầu, có nút Bỏ lưu trực tiếp.
- [x] Kiểm chứng thật: lưu/bỏ lưu cập nhật UI ngay, đồng bộ đúng giữa trang truyện và Tủ truyện,
      thứ tự đúng, console sạch lỗi.
- **Bug phát sinh đã tự sửa (systematic-debugging)**: sau khi Antigravity code xong, nút Lưu luôn
  fail âm thầm (`thanhCong: false`) dù server action không throw exception — tra bằng service role
  key phát hiện nguyên nhân thật: **user quên chưa chạy SQL migration** nên bảng `truyen_da_luu`
  chưa tồn tại (Supabase trả lỗi "table not found", bị code nuốt thành `false`). Không phải lỗi
  code. Bài học: khi nút bấm "chạy nhưng không có tác dụng" mà server không log exception, nghi
  ngay bảng/cột chưa tồn tại — dùng `SUPABASE_SERVICE_ROLE_KEY` (có sẵn `.env.local`) để tra thẳng
  qua script Node, nhanh hơn nhiều so với đoán qua RLS/logic.
- Phát hiện thêm (chưa gây bug lần này nhưng đã fix phòng ngừa): nút Lưu/Bỏ lưu không khoá trong
  lúc đang xử lý — bấm nhanh 2 lần liên tiếp có thể tạo request chồng nhau, request sau bị lỗi
  duplicate-key/xoá-0-dòng làm lệch trạng thái hiển thị so với DB thật. Đã thêm `dangXuLy` state
  chặn bấm lặp ở cả `NutLuuTruyen.tsx` và `DongTruyenDaLuu.tsx`.

Sẵn tiện làm luôn (user yêu cầu giữa buổi, đã brainstorm riêng): spec
`docs/superpowers/specs/2026-09-13-header-full-width-design.md` → plan
`docs/superpowers/plans/2026-09-13-header-full-width.md` (việc nhỏ, Claude tự làm không qua
Antigravity):
- [x] `Header.tsx` full-width theo mẫu truyendich.ai — logo (icon sách + "Truyện chữ dịch") + dropdown
      Thể loại bên trái, ô tìm kiếm (`SearchBox.tsx`, chuyển từ trang chủ lên Header, dùng được mọi
      trang) bên phải. Responsive: xuống hàng ở khổ mobile, không vỡ layout.
- [x] Đổi tên hiển thị site "Truyện dịch AI" → "**Truyện chữ dịch**" (Header + `metadata.title`,
      trước đó vẫn là "Create Next App" mặc định, chưa từng sửa).
- [x] Bỏ tiêu đề `<h1>` lặp lại trên trang chủ (Header đã đảm nhiệm).
- [x] Kiểm chứng thật qua browser: Header đúng trên mọi trang, tìm kiếm từ trang khác trang chủ vẫn
      điều hướng + lọc đúng, dropdown Thể loại vẫn hoạt động ở cả desktop/mobile, tiêu đề tab đúng,
      console sạch lỗi. Build + 38/38 test pass.
- User dự định tự deploy Vercel + mua domain Namecheap sau — chưa làm trong phiên này, xem mục
  "Bước tiếp theo" cũ (Task 11) ở dưới.

## Đợt C — Thanh điều hướng + Trang Tài khoản + Theme toàn site: xong hoàn toàn + kiểm chứng thật

Brainstorm → spec `docs/superpowers/specs/2026-09-11-thanh-dieu-huong-tai-khoan-design.md` → plan
`docs/superpowers/plans/2026-09-11-thanh-dieu-huong-tai-khoan.md` (11 Task) → giao Antigravity thực
thi 10 Task đầu trong 1 lượt → Claude tự kiểm chứng qua browser thật + đọc lại code.

- [x] Thanh điều hướng icon nổi bên trái (`components/ThanhDieuHuong.tsx`): 3 icon Trang
      chủ/Tài khoản/Tủ truyện, tooltip khi hover, tô đậm đúng trang đang mở.
- [x] Trang `/tai-khoan`: hồ sơ (tên/email/"Cấp độ: Thành viên" tĩnh) khi đã đăng nhập, nút Đăng
      nhập/Đăng ký khi chưa đăng nhập, mục Giao diện (`ChonTheme.tsx`), mục Cài đặt placeholder
      "Sắp ra mắt".
- [x] Trang `/tu-truyen`: tạm thời chỉ có "Sắp ra mắt, đang phát triển" — nội dung thật (3 tab Đã
      đọc/Đã lưu/Đã thêm) để bàn thiết kế riêng đợt sau.
- [x] Theme toàn site 3 chế độ Sáng/Giấy/Tối (`lib/utils/theme.ts`, biến CSS trong
      `app/globals.css`), lưu `localStorage`, áp dụng ngay không cần reload, chống FOUC bằng
      `next/script` `strategy="beforeInteractive"` — **hoàn tất dứt điểm Task 10 dark mode** còn
      treo từ v1. Độc lập hoàn toàn với cài đặt đọc riêng của trang chương (không đụng
      `cai-dat-doc.ts`/`KhungDocChuong.tsx`/`PanelCaiDatDoc.tsx`).
- [x] `Header.tsx` bỏ hẳn đăng nhập/đăng ký/"Xin chào {tên}"/đăng xuất — chuyển hết vai trò này
      sang trang Tài khoản.
- [x] Kiểm chứng thật qua browser: đổi theme Sáng→Tối áp dụng ngay toàn site (trang chủ, trang
      truyện, trang thể loại, thanh điều hướng); reload giữ nguyên theme không nhấp nháy; trang đọc
      chương vẫn giữ nền riêng không bị theme toàn site chi phối; Header không còn đăng nhập/đăng
      xuất; console sạch lỗi (tab mới hoàn toàn, không tính nhiễu HMR lúc đang sửa code). Build +
      38/38 test đều pass.
- Lỗi phát sinh đã tự sửa: `<script dangerouslySetInnerHTML>` thô trong `<head>` bị React log lỗi
  "Encountered a script tag..." — đổi sang `next/script` (`strategy="beforeInteractive"`, built-in
  Next.js, không phải dependency mới) là hết. Ban đầu tưởng lỗi vẫn còn khi test lại trên tab cũ,
  hoá ra chỉ là nhiễu do HMR lúc đang sửa file — mở tab trình duyệt mới hoàn toàn mới xác nhận được
  sạch thật.
- Đã gộp commit luôn 2 fix nhỏ còn treo từ trước (chưa commit): nút "Aa" trang đọc chương (bug nửa
  trên không bấm được do `<p opacity-70>` tạo stacking context đè lên — fix bằng `z-20` + thêm
  click-outside-to-close) và dropdown "Thể loại" đổi từ click sang hover.

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

## Bước tiếp theo — ưu tiên số 1: hệ thống trả phí / tài khoản VIP

User đã xác nhận muốn làm ngay phiên tới (deploy xong rồi, xem mục đầu file + `CLAUDE.md`). **Bắt
buộc dùng skill `brainstorming` trước** (đây là tính năng lớn, ảnh hưởng doanh thu, chưa chốt thiết
kế) rồi mới `writing-plans` → giao Antigravity code theo quy trình chuẩn của dự án. Đọc kỹ ý tưởng
ban đầu của user trong `CLAUDE.md` mục "Kế hoạch tiếp theo" trước khi bắt đầu brainstorm — còn nhiều
điểm chưa rõ cần hỏi lại: chọn cổng thanh toán nào (VNPay/Momo/PayOS...), cơ chế webhook nâng cấp
tài khoản, ngưỡng 50 chương free áp dụng thế nào với truyện mới ít hơn 50 chương, thời điểm hết hạn
gói tính theo giờ hay theo ngày lịch, có cho mua nhiều gói cộng dồn không...

## Việc nhỏ còn tồn đọng (làm sau, không gấp)

1. **Nội dung thật còn lại của trang Tủ truyện** (2 tab Đã đọc/Đã thêm — "Đã lưu" đã xong hoàn toàn
   2026-09-13) — "Đã đọc" có thể tận dụng `tien_do_doc` sẵn có, "Đã thêm" chưa rõ ý nghĩa, cần hỏi
   lại user.
2. **Việc nhỏ còn sót của Đợt B lượt xem**: kịch bản 4 (verify `visitor_key = nguoidung:<user_id>`
   khi đăng nhập đọc chương) — giờ đã có tài khoản thật đăng nhập được, có thể nhờ user tiện thể đọc
   1 chương lúc đang đăng nhập rồi kiểm tra bảng `luot_xem_da_doc`.
3. **Bàn thiết kế Đợt B phần còn lại** (đánh giá sao, "Top thịnh hành", sidebar "Đọc tiếp") — dùng
   skill `brainstorming` trước khi code, giống quy trình đã làm với Đợt A/lượt xem/đăng nhập.

## Lưu ý quan trọng
- `.env.local` đã điền đủ 4 biến (kể cả `SUPABASE_SERVICE_ROLE_KEY`) — không hỏi lại, không in
  giá trị ra chat.
- Chạy `sync-truyen.mjs` phải dùng `node --env-file=.env.local scripts/sync-truyen.mjs ...`. Từ
  2026-09-13 script tự in thêm báo cáo kiểm tra tính liên tục số chương sau khi đăng — xem mục cập
  nhật truyện 2026-09-13 ở trên trước khi hỏi lại user về việc này.
- **[ĐÃ LỖI THỜI — xem lại]** Ghi chú cũ "Tà Tu Hảo A có khoảng trống chương 2-10" KHÔNG còn đúng —
  đã cập nhật đủ 510/510 chương ngày 2026-09-13 (nguồn dịch đã bổ sung các chương đó). Không cần
  nhắc lại ghi chú này nữa.
- Nếu 1 bộ truyện mới "check" báo lỗi parse/thiếu hàng loạt (gần như toàn bộ file), xem
  `docs/handoff/cap-nhat-truyen-loi-mang-va-dinh-dang.md` trước khi báo user — khả năng cao là do
  nguồn dịch khác định dạng (đã gặp 2 lần: dấu `#` tiêu đề chương, dấu phân cách thể loại), không
  phải lỗi code hay lỗi mạng.

## Quyết định đang chờ user
- Các câu hỏi mở cần chốt trước khi code hệ thống trả phí — xem mục "Bước tiếp theo" phía trên.
