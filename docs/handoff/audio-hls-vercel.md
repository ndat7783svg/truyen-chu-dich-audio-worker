# Audio thật kiểu HLS, tạo theo đoạn nhỏ trên Vercel (2026-09-19)

Spec: `docs/superpowers/specs/2026-09-19-audio-hls-vercel-design.md` — Plan:
`docs/superpowers/plans/2026-09-19-audio-hls-vercel.md`. Đã deploy production 2026-09-19.

## Vì sao đổi
Cách cũ (tạo CẢ chương qua GitHub Actions rồi mới phát) chậm 85-127s + ~3.5 phút overhead, hay kẹt khi
nhiều người gọi, tốn Supabase Storage, `msedge-tts` hay treo. Đối thủ (truyendich.space) phát HLS theo đoạn
nhỏ. Bản mới: Vercel tạo đúng từng đoạn khi trình phát xin; không thuê máy chủ, không lưu file audio.

## Số liệu đo thật (đừng đoán lại)
- Trên máy user (WARP): đoạn 600 ký tự ~22s (quá chậm), đoạn 100-150 ký tự ~3-4s. ~1/5 lần lỗi ngắt.
- Trên Vercel (sin1): 132 lần gọi thử 0 lỗi/0 lần 403 từ Microsoft. Production: đoạn đầu ~1.6s, lần gọi
  lại `X-Vercel-Cache: HIT` ~0.47s.
- Ước lượng thời lượng đoạn: `ký tự / 17.1 + 0.73` giây (hồi quy 17 mẫu). Đoạn đầu ≤100 ký tự, sau ≤200,
  cắt cứng ở 250.
- Thử HLS thật: Chrome desktop phát sau 0.7s; Android OK; iPhone (Safari) OK — cả có/không ID3 timestamp
  (bản chính KHÔNG dùng ID3).

## Bài học kỹ thuật
- **Chrome mới báo `canPlayType('application/vnd.apple.mpegurl')` = có nhưng KHÔNG phát được** đoạn MP3
  thuần (lỗi code 4). Phải chọn theo user-agent (`lib/audio/nhan-dien-trinh-duyet.ts`): Safari/iOS → HLS
  gốc, còn lại → hls.js.
- **iPhone chặn `play()` sau `await`**: bấm "Bắt đầu" phải gán `src`/gọi `play()` ĐỒNG BỘ trong sự kiện bấm,
  manifest tải song song chỉ để dựng giao diện.
- vitest của dự án KHÔNG có alias `@/` → file `lib/` được test phải import tương đối. Số `h` (timestamp giây)
  có 10 chữ số → regex tham số không được giới hạn 9 chữ số.
- Bộ đếm đồng thời: KHÔNG gia hạn `expire` mỗi lần incr (dùng `NX`), nếu không slot rò rỉ (hàm bị kill) sống
  mãi khi còn traffic → cả site trả 503. Tổng thời gian thử lại TTS phải < `maxDuration` (60s) của route.
- Vé VIP không được sống lâu hơn `goi_het_han` của người dùng (`hetHanVipGiay` trong `QuyenNghe`).
- Mốc chương trên iPhone/Safari suy từ thời lượng ƯỚC LƯỢNG nên có thể lệch chữ hiển thị vài chục giây tới
  vài phút ở chương xa; hls.js (Chrome/Android) chính xác nhờ sự kiện `FRAG_CHANGED`. Không ảnh hưởng âm thanh.
- Antigravity chế độ `plan` VẪN tạo file thật (không giữ read-only) — đừng tin `mode: plan` là an toàn.
- Antigravity thêm `eslint-disable react-hooks/set-state-in-effect` vào cả file cũ có sẵn (PanelDocAudio,
  KhungDocChuong) — 2 file này đã có sẵn 4 lỗi lint từ trước, không cần và đã gỡ.

## Kết quả self code-review (10 phát hiện, đã sửa 8)
Đã sửa: bộ đếm đồng thời kẹt, ngân sách thời gian TTS, hạn vé theo gói, đua trạng thái khi bấm liên tiếp,
lỗi HLS gốc không báo, bộ đếm thử lại không reset, tham số phi lý gây 500, đồng bộ chữ không thử lại.
Cố ý chưa sửa: (1) rate limit theo IP có thể quá chặt với IP dùng chung (CGNAT/wifi trường) — chỉnh khi có số
liệu thật (`taoGioiHanPlaylist` 30/10 phút, mỗi lần Start tốn 2 lượt; `taoGioiHanDoan` 60/phút);
(2) manifest + playlist mỗi cái đọc 12 chương, mỗi đoạn đọc lại cả chương — chỉ tốn DB/độ trễ.

## Cập nhật cuối ngày 2026-09-19: đứt đoạn ở 1.5x, khoá thanh tua, gỡ hệ cũ

**Triệu chứng user báo**: nghe 1.5x hay đứt 3-5s. **Đo thật trên production** (chương chưa lưu tạm, 1.5x, 100s): trước sửa 7 lần đứng, tổng 38s, bộ đệm phía trước 0-7s; sau nạp trước (2 lần đo) 1 lần đứng 2.4s và 2 lần đứng tổng 8.2s (đều ở phút đầu), bộ đệm 22-50s; sau khi thêm chờ đệm 10s: 0 lần đứng.

**Nguyên nhân**: hls.js chỉ tải TUẦN TỰ từng đoạn nên không tích được bộ đệm; đoạn nào tạo chậm là hết đệm (1.5x ăn đệm nhanh hơn). **Đã sửa**: (1) trình phát nạp trước 4 đoạn phía sau song song (`napTruocDoan`, tối đa 3 request cùng lúc) vào bộ nhớ đệm trình duyệt + hls.js `maxBufferLength` 120s; đoạn chương VIP đổi `no-store` -> `private, max-age=3600` để trình duyệt giữ được (CDN dùng chung vẫn không lưu); manifest trả thêm `ve` để trình phát tự dựng URL đoạn VIP; (2) `chay-co-du-phong.ts`: thử lại nhanh khi lỗi (nghỉ 400ms, tối đa 4 lần trong ngân sách 52s), chạy dự phòng song song chỉ khi lần đầu treo >11s; (3) trần đồng thời toàn site 20 -> 30; (4) CDN giữ đoạn chương free 7 ngày.

**Chờ đệm ~10s trước khi phát (user chọn, 2026-09-19)**: trình phát KHÔNG phát ngay mà đợi đệm đủ 10s phía trước (tối đa chờ 30s rồi phát bất kể), trong lúc chờ hiện dòng "Đang tạo audio... vui lòng đợi vài giây để nghe (Ns)"; dòng này cũng hiện khi đang phát mà bị đứng chờ đoạn kế (sự kiện `waiting`). Hết chờ thì `el.play()` (Chrome/Android không cần cử chỉ vì đã có tương tác; bấm Phát thủ công = bỏ qua chờ). Safari/iOS buộc `play()` đồng bộ lúc bấm nên `onPlaying` tạm dừng lại tới khi đủ đệm rồi `play()` lại — CHƯA kiểm chứng trên iPhone thật. **Đo thật production ở 1.5x, 100s, chương mới**: có tiếng sau ~9s, 0 lần đứng, đệm 20-47s (trước khi thêm chờ: 1-2 lần đứng ~4s ở phút đầu).

**Khoá thanh tua**: thanh tiến độ chỉ hiển thị (`pointer-events-none`, `tabIndex -1`), vì audio tạo theo đoạn nên tua tới chỗ chưa tạo sẽ đứng. Nút ±10s và nút chương kế của màn hình khoá vẫn nhảy được (nhảy ngắn/đã nạp trước).

**BÀI HỌC QUAN TRỌNG về Microsoft TTS (msedge-tts)** — chẩn đoán bằng header `Server-Timing` + `X-Audio-Nhat-Ky` (giữ lại trong route `doan`, xem bằng `curl -D`): dịch vụ có 2 chế độ tuỳ mức dùng — NHANH ~0.5s/đoạn 200 ký tự (dự án thử nghiệm `tts-thu-nghiem` lúc ít dùng) và CHẬM ~4-13s/đoạn (xấp xỉ tốc độ đọc thật) khi web chính bị dùng liên tục; ~30% lần thử đầu bị Microsoft đóng kết nối sau đúng ~2.4s ("Stream closed before the synthesis completed") nhưng lần thử lại thành công. Hedge ngưỡng 6s (bản đầu) làm XẤU thêm: ở chế độ chậm hầu như đoạn nào cũng >6s nên bị nhân đôi kết nối -> Microsoft đóng nhiều hơn (502 cuối cùng 12% -> sau chỉnh ~2.5%). Đây là hạn chế cố hữu của dịch vụ miễn phí không chính thức; nhiều người nghe cùng lúc có thể chậm hơn. Hướng triệt để nếu cần: TTS trả phí (Azure/Google, ~16$/1 triệu ký tự — user từng từ chối vì ngân sách) hoặc VPS riêng (không chắc hết bị giới hạn theo IP). KHÔNG dùng `hedge` thấp.

**Gỡ hệ audio cũ (2026-09-19, theo đồng ý của user)**: `git rm` ModalNgheAudioThat.tsx, actions-audio(+test), scripts/worker-audio-chuong.mjs, tao-audio-chuong.mjs, lib/tao-audio-logic(+test), .github/workflows/worker-audio-chuong.yml; bỏ `audioUrl`/`audio_url` khỏi page.tsx/KhungDocChuong/PanelDocAudio; xoá 2 file audio + bucket `audio-chuong` trên Supabase (14MB). Khôi phục code từ lịch sử git (commit 88350f6 là commit gỡ) nếu cần. **ĐÃ HOÀN TẤT 2026-09-19 (a)(b)(c bên dưới đều xong, đã xác minh DB bằng REST)** — mô tả gốc: (a) chạy SQL cuối `supabase/schema.sql` ("GỠ HỆ THỐNG AUDIO CŨ": drop 2 hàm RPC, bảng `hang_doi_audio`, cột `truyen.audio_truy_cap_luc`, `chuong.audio_url`) — CHỈ sau khi bản web mới đã deploy (đã deploy); (b) xoá biến `GITHUB_DISPATCH_TOKEN` trên Vercel và thu hồi token PAT trên GitHub; (c) repo GitHub `truyen-chu-dich-audio-worker` (remote origin của repo này) còn workflow cũ trên GitHub cho tới khi push commit gỡ — tắt/archive tuỳ user.

## Đứng audio ở nửa sau chương ở 1.5x — sửa bằng nạp trước sâu hơn (2026-09-19 tối)

**Triệu chứng user báo**: nghe 1.5x chương 59 "Quốc Thuật...", từ ~phút thứ 5 cứ 30s-1 phút đứng 1 lần ("Đang tạo audio..."). Đầu chương thì mượt.

**Số đo thật (mô phỏng người nghe trên chương free chưa cache, 4 kết nối, 2 lượt x 30-40 đoạn)**: mỗi kết nối chỉ tạo ~1x thời gian thực (đoạn ~9s audio mất trung vị 11.5s, p90 15-18s, có đoạn 35s); ~50% lần thử đầu bị Microsoft đóng "Stream closed" sau ~2.4s rồi thử lại (lần thứ 2 hay lỗi tiếp sau ~5.3s, thành công ở lần 3 ~10-15s); 10-15% đoạn ra 502 cuối cùng. Nghe 1.5x tiêu thụ 1 đoạn/~6s nên tốc độ tạo trung bình (2.3-2.8x với 4 kết nối) vẫn đủ nhưng bộ đệm chỉ ~4 đoạn (~25s) thì 1 đoạn chậm/502 là hết đệm. Log Vercel cho thấy 502 thật rất ít (mỗi sự kiện bị lặp 20 lần trong `vercel logs --json`, đừng đếm thô); nguyên nhân là ĐỘ TRỄ chứ không phải lỗi liên tục. Chương VIP còn tệ hơn vì không có CDN giữ.

**Mô phỏng theo số đo** (script scratchpad, lấy mẫu độ trễ thật): nạp trước 4 đoạn/3 song song -> đứng ~0.6 lần/phút (khớp báo cáo); từ 8 đoạn trở lên -> gần như 0. **Đã sửa** `ModalNgheAudioHls.tsx`: `SO_DOAN_NAP_TRUOC` 4 -> 10, `TOI_DA_NAP_DONG_THOI` 3 -> 4 (commit 6d7f157). **Kiểm chứng thật production 1.5x**: audio đã phát 6:15 (qua mốc phút 5) liên tục, 0 lần đứng, 0 sự kiện waiting/stalled, bộ đệm 56-124s (trước đó 20-50s). Chưa A/B cùng điều kiện với bản cũ (chỉ có mô phỏng + báo cáo user).
- Đánh đổi: 4 kết nối nạp trước + 1 của hls.js/người nghe; trần đồng thời toàn site là 30 -> khoảng 6 người nghe cùng lúc là chạm trần (503 cho người kế). Nếu nhiều người dùng cùng lúc: cân nhắc TTS trả phí hoặc hạ lại.
- Quan sát chưa giải thích: trong lần thử desktop, audio tự `paused` 1 lần ở giây 161 mà không có lệnh dừng từ code mình (bấm play lại chạy bình thường, lần sau không lặp lại); nghi khung trình duyệt nhúng của công cụ thử. Nếu user báo audio tự dừng (không phải quay "Đang tạo") trên điện thoại thì điều tra tiếp.

## Vận hành
- Biến môi trường Vercel Production: `SUPABASE_SERVICE_ROLE_KEY` (đã có), `AUDIO_TICKET_SECRET` (mới, thêm
  2026-09-19 bằng `vercel env add ... --sensitive`). Thiếu `AUDIO_TICKET_SECRET` → chương VIP trả 500 (fail đóng).
- `/api/audio/doan` bị loại khỏi middleware (`matcher`) để không gọi Supabase Auth mỗi đoạn và không Set-Cookie
  làm hỏng cache CDN.
- Hệ audio cũ đã gỡ (xem mục cập nhật cuối ngày ở trên).
- Dự án Vercel tạm `tts-thu-nghiem` (asuo-team) và thư mục scratchpad thử nghiệm còn giữ — hỏi user xoá.
