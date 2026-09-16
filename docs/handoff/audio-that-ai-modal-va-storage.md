# Audio thật (AI) — modal, chuyển chương liền mạch, dọn dẹp storage

Tiếp nối tính năng audio thật (edge-tts) đã code ở phiên trước (xem
`tinh-nang-nghe-chuong-va-nghien-cuu-tts.md` cho phần nghiên cứu benchmark gốc). Phiên này
(2026-09-16) hoàn thiện modal trình phát + phát hiện, sửa nhiều bug thật qua kiểm chứng browser +
dữ liệu Supabase/GitHub API thật, và chốt kiến trúc quản lý storage.

## Bug 1: Modal bị "đè" — `position: fixed` bị kẹt trong vùng 56px

**Triệu chứng** (báo qua ảnh chụp production thật): modal trình phát audio không có nền tối phủ
kín, không có thanh tiêu đề/nút X, nằm co cụm gần mép trên màn hình thay vì giữa màn hình.

**Nguyên nhân thật** (xác nhận bằng `getBoundingClientRect()` + `getComputedStyle()` qua
`javascript_tool` trực tiếp trên trang, không đoán): `ModalNgheAudioThat` (`fixed inset-0`) bị
render lồng bên trong `<div className="fixed top-0 inset-x-0 z-40 h-14 transition-transform ...">`
của `KhungDocChuong.tsx` — thanh nav tự ẩn/hiện khi cuộn. Theo đúng chuẩn CSS: một phần tử có
`transform` (kể cả `translate-y-0`/`-translate-y-full` từ Tailwind) sẽ trở thành **containing
block** cho MỌI phần tử con `position: fixed`, khiến `fixed inset-0` của modal bị tính theo khung
56px (`h-14`) của thanh nav thay vì theo toàn viewport.

**Cách sửa**: dùng `createPortal` (từ `react-dom`) đưa cả audio lẫn phần UI modal ra thẳng
`document.body`, thoát khỏi mọi ancestor có `transform`. Cần thêm state `daMount` (set `true` trong
`useEffect` rỗng) vì `document` không tồn tại lúc render phía server.

## Bug 2: Đóng modal (nút X) làm mất tiếng — do unmount thẻ `<audio>`

Code gốc: `if (!moModal) return null;` — khi đóng modal, **toàn bộ component return null**, kéo
theo thẻ `<audio>` bị unmount, dừng phát nhạc hẳn (trái với yêu cầu: đóng modal chỉ ẩn UI, audio
phải tiếp tục chạy nền).

**Cách sửa + 1 bẫy phát sinh khi sửa lần đầu**: lần sửa đầu tiên để `<audio>` "khi thì render trực
tiếp (modal đóng), khi thì render trong portal (modal mở)" — khiến React coi đây là 2 vị trí khác
nhau trong cây, **unmount rồi tạo lại `<audio>` mỗi lần đóng/mở modal** (mất tiến độ nghe, giật).
Sửa đúng: `<audio>` phải LUÔN nằm trong 1 `createPortal` **cố định**, tách biệt hoàn toàn khỏi việc
UI modal đang hiện hay ẩn — chỉ phần UI modal (nút X, tiêu đề, các nút điều khiển) mới bị ẩn/hiện
theo `moModal`.

## Kiến trúc "chuyển chương liền mạch" (không `router.push`)

Yêu cầu: nghe xong chương này tự chuyển sang chương sau MÀ KHÔNG load lại trang (giữ audio chạy nền
liên tục khi khoá màn hình) — chữ hiển thị cũng phải tự chuyển theo (đã hỏi & chốt với user).

- `KhungDocChuong.tsx` giờ giữ state `chuongHienTai` (khởi tạo từ props server-render), có callback
  `xuLyChuyenChuongMoi` nhận dữ liệu chương mới từ modal, cập nhật state + `window.history.replaceState`
  (KHÔNG dùng `router.push`/`replace` của Next.js — sẽ trigger fetch lại RSC/remount cả trang).
- `ModalNgheAudioThat.chuyenChuongTiepClient()`: lấy dữ liệu chương kế tiếp trực tiếp bằng Supabase
  client (anon key) — cột `chuong` đã GRANT sẵn (`id, truyen_id, so_chuong, tieu_de, audio_url`) +
  gọi RPC `lay_noi_dung_chuong` (SECURITY DEFINER, tự kiểm tra free/VIP, trả `null` nếu không đủ
  quyền) lấy nội dung chữ — **an toàn gọi thẳng từ client** vì RPC tự gate quyền bên trong Postgres,
  không cần lặp lại logic gate ở client.
- Nếu RPC trả `null` (chạm ranh giới VIP giữa lúc đang tự động chuyển chương): dừng audio, hiện
  ngay trong modal 1 khối "Chương X cần gói VIP" (không điều hướng trang, giữ nguyên chữ chương cũ
  đang đọc dở).
- `DanhSachChuong.tsx` tự theo dõi `soChuongHienTai` đổi, tự tải lại đúng nhóm 50-chương phân trang
  khi audio vượt ranh giới nhóm (không cần user tự bấm).
- Vẫn giữ side-effect ghi lượt xem + lưu tiến độ đọc: tách `ghiLuotXemChuong` từ logic gốc trong
  `page.tsx` (vốn chỉ chạy lúc SSR) thành 1 server action riêng trong `actions.ts`, gọi được cả từ
  SSR (giữ nguyên hành vi cũ khi vào thẳng URL/bấm Link) lẫn từ client khi chuyển chương kiểu mới.

### Bug race condition phát hiện khi tự review diff (không phải do Antigravity báo)

Effect đồng bộ state theo props `[audioUrl, chuongId]` (vốn có từ trước, dùng để reset state mỗi
khi ĐIỀU HƯỚNG TRANG sang chương khác) vẫn tồn tại sau khi thêm cơ chế chuyển chương client-side.
Vì `chuongId` (prop) cũng đổi theo `chuongHienTai` khi chuyển chương kiểu mới, effect này VẪN CHẠY
LẠI và **ghi đè `dangChuanBi` về `false` ngay sau khi `chuyenChuongTiepClient` vừa bật lên `true`**
(trường hợp chương sau chưa có audio sẵn) — tái tạo đúng bug gốc (hiện lại nút "Bắt đầu" dù đang
mồi audio). Sửa bằng 1 ref cờ `boQuaDongBoRef`: set `true` ngay trước khi gọi callback đổi chương,
effect kiểm tra cờ này và bỏ qua đúng 1 lần rồi tự xoá. Đã suy luận chắc chắn qua ngữ nghĩa dependency
array của React (không tái hiện trực tiếp được bằng test sống vì mọi chương gần đó đã có sẵn audio
từ lần test trước — đã thử giả lập bằng cách ghi đè `window.fetch` chặn response nhưng supabase-js
có vẻ giữ tham chiếu `fetch` riêng, không bị ghi đè qua `window.fetch =` — chưa tìm cách giả lập
được, chỉ verify bằng đọc code + build/test sạch).

## Phát hiện quan trọng: GitHub Actions `schedule` cron KHÔNG đáng tin cậy

Worker audio (`worker-audio-chuong.mjs`) chạy qua GitHub Actions, có cấu hình cron `*/5 * * * *`
làm lưới an toàn dự phòng cho hàng đợi `hang_doi_audio`. Xác nhận qua GitHub REST API
(`/actions/workflows/{id}/runs?event=schedule`): **`total_count: 0`** — cron chưa từng chạy lần
nào trong hơn 2 tiếng (đáng lẽ phải chạy ~24 lần), dù workflow ở trạng thái `active`, cú pháp cron
hợp lệ, repo không phải fork, default branch khớp. Đây là hạn chế đã biết của nền tảng GitHub
Actions (không đảm bảo lịch `schedule` chạy đúng giờ, có thể bị trễ/bỏ qua âm thầm), không phải lỗi
cấu hình của dự án.

**Hệ quả phát hiện thêm**: cơ chế "mồi trước chương sau" (gọi khi chương hiện tại bắt đầu phát) chỉ
đang GHI vào hàng đợi qua RPC `xep_hang_tao_audio`, KHÔNG tự kích hoạt `workflow_dispatch` — nên
phụ thuộc hoàn toàn vào cron để thực sự xử lý, mà cron lại không chạy → chương mồi trước gần như
không bao giờ thực sự được tạo trước, giải thích đúng triệu chứng user báo ("nghe xong 9 phút,
qua chương 2 vẫn phải đợi tạo mới"). **Đã sửa**: mọi chỗ mồi trước đổi từ gọi RPC trực tiếp sang
gọi server action `yeuCauTaoAudioNgay` (vốn đã có sẵn, dùng cho nút "Bắt đầu") — action này VỪA ghi
hàng đợi VỪA gọi `workflow_dispatch` kích hoạt chạy ngay, không phụ thuộc cron nữa.

**Bài học áp dụng cho việc khác cần "job nền định kỳ"**: không nên tin tưởng cron GitHub Actions là
kênh DUY NHẤT để đảm bảo 1 việc chắc chắn xảy ra — nên gắn logic quan trọng vào những lần dispatch
CHẮC CHẮN chạy (do người dùng/hệ thống chủ động kích hoạt), coi cron chỉ là lưới an toàn phụ.

## Kiến trúc quản lý File Storage (free tier 1GB)

Phát hiện qua đo đạc thật: 130 file audio (~2 truyện có audio, chưa tính 9 truyện còn lại) đã chiếm
**~1085MB**, gần như chạm hẳn giới hạn 1GB free tier của Supabase Storage. Số liệu tham chiếu đã
xác nhận qua WebSearch (2026): Supabase free = 500MB Database + **1GB File Storage** + 5GB egress/
tháng; Cloudflare R2 free = 10GB storage + **egress miễn phí hoàn toàn**. Database (nơi chứa chữ
truyện) và File Storage (nơi chứa audio + ảnh bìa) là 2 hạn mức TÁCH BIỆT — đo thật cho thấy 6032
chương/11 truyện chỉ chiếm ~63MB Database, không đáng lo; vấn đề CHỈ nằm ở File Storage do audio.

**Đã cân nhắc và loại**: TTL cố định theo thời gian tạo (ví dụ xoá đúng 1 tiếng sau khi tạo) — có
lỗ hổng do chính user phát hiện: người đang nghe dở 1 file audio dài hơn TTL sẽ bị ngắt giữa chừng
vì file bị xoá trong lúc vẫn đang phát.

**Đã chọn (theo yêu cầu cụ thể của user)**: xoá theo TỪNG BỘ TRUYỆN (không phải từng chương) khi
không có ai NGHE (không phải chỉ xem trang) audio của bộ đó quá **12 tiếng**.
- Cột mới `truyen.audio_truy_cap_luc` (timestamptz) + RPC `ghi_nhan_nghe_audio(p_truyen_id)`
  (SECURITY DEFINER) — gọi từ `ModalNgheAudioThat` mỗi khi sự kiện `onPlay` thật của thẻ `<audio>`
  bắn ra (không phải khi mở modal), throttle 2 phút/lần để tránh gọi dồn dập lúc tua/pause liên tục.
- Hàm `donDepAudioKhongHoatDong(supabase)` (`scripts/lib/tao-audio-logic.mjs`): quét `truyen` có
  `audio_truy_cap_luc` cũ hơn 12h VÀ còn chương có `audio_url`, xoá sạch file trong Storage +ả reset
  `audio_url = null` cho cả bộ. Được gọi ở ĐẦU `worker-audio-chuong.mjs`, tức chạy mỗi lần worker
  được kích hoạt THẬT (không đợi cron) — nhất quán với bài học ở mục cron phía trên.
- Đã reset sạch dữ liệu audio cũ trên production (xoá cả 130 file + null hết `audio_url`) theo yêu
  cầu rõ ràng của user, để bắt đầu lại từ trạng thái sạch với cơ chế mới.

**Việc CHƯA làm, cân nhắc sau nếu 1GB vẫn không đủ dù đã dọn dẹp 12h**: chuyển sang Cloudflare R2
(10GB free + egress miễn phí) — user đã được giải thích ưu/nhược điểm (thêm tài khoản/API key, sửa
lại code upload, di chuyển file cũ) và **chủ động chọn KHÔNG chuyển ngay**, ưu tiên ở lại Supabase
Storage một mình + cơ chế dọn dẹp 12h trước, chỉ cân nhắc R2 khi thực sự cần.

## Kiểm chứng đã làm (browser thật, không chỉ đọc code)

- Portal fix: `getBoundingClientRect()` xác nhận backdrop trước/sau sửa; ảnh chụp modal đúng giữa
  màn hình, đầy đủ header/nút X trên production thật.
- Audio giữ tiến độ khi đóng/mở modal: đóng lúc `00:19`, mở lại vẫn `00:19` (không reset).
- Chuyển chương liền mạch: seek nhanh gần hết audio (giả lập kết thúc tự nhiên) qua chuỗi 15 chương
  liên tiếp (chương 1→15) trên `next dev` cục bộ — chữ, tiêu đề, URL (`history.replaceState`) đều
  đổi đúng, không load lại trang.
- Ranh giới VIP giữa lúc tự động chuyển chương (chương 50→51 lúc chưa đăng nhập): dừng audio, hiện
  đúng khối "Chương 51 cần gói VIP", giữ nguyên chữ chương 50.
- Xác nhận qua GitHub REST API thật (không đoán): lịch sử run, trạng thái workflow, thời điểm commit
  file workflow để loại trừ nguyên nhân do độ trễ tự nhiên.
- Sau khi thêm cơ chế dọn dẹp: chạy `worker-audio-chuong.mjs` cục bộ trên dữ liệu production thật —
  in đúng "Khong co bo truyen nao can don" (vì vừa reset, `audio_truy_cap_luc` còn null — đúng dự
  đoán, không bị lọc nhầm). Test RPC `ghi_nhan_nghe_audio` qua browser thật trên production, xác
  nhận `audio_truy_cap_luc` được ghi đúng giờ ngay sau khi bấm phát.
