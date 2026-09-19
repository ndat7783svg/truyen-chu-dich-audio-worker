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

## Vận hành
- Biến môi trường Vercel Production: `SUPABASE_SERVICE_ROLE_KEY` (đã có), `AUDIO_TICKET_SECRET` (mới, thêm
  2026-09-19 bằng `vercel env add ... --sensitive`). Thiếu `AUDIO_TICKET_SECRET` → chương VIP trả 500 (fail đóng).
- `/api/audio/doan` bị loại khỏi middleware (`matcher`) để không gọi Supabase Auth mỗi đoạn và không Set-Cookie
  làm hỏng cache CDN.
- Code + dữ liệu audio CŨ vẫn nguyên (chưa gỡ): `ModalNgheAudioThat.tsx`, `actions-audio.ts`, workflow GitHub
  Actions worker, `hang_doi_audio`, bucket `audio-chuong`, `chuong.audio_url`, cron dọn 12h. Gỡ khi user xác
  nhận bản mới ổn (hỏi user trước khi xoá).
- Dự án Vercel tạm `tts-thu-nghiem` (asuo-team) và thư mục scratchpad thử nghiệm còn giữ — hỏi user xoá.
