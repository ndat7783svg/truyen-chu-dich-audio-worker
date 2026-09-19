# Thiết kế: Audio thật phát dạng HLS, tạo theo đoạn nhỏ trên Vercel (2026-09-19)

## Mục tiêu
Thay cách tạo audio "cả chương qua GitHub Actions rồi mới phát" (chậm 85-127s + ~3.5 phút overhead, hay kẹt,
tốn Supabase Storage) bằng cách của truyendich.space: chia chương thành đoạn nhỏ, tạo đoạn đầu trước
và phát ngay (~1-5s), các đoạn sau tạo dần khi trình phát cần. Không thuê máy chủ, không lưu file audio
lên Supabase. Vẫn nghe được khi tắt màn hình, tự chuyển chương liền mạch.

Ngân sách: user chốt free (ngân sách ~1$/tháng). Phương án thuê VPS (C) chỉ khi sau này có tiền.

## Bằng chứng đã đo (2026-09-19, dự án Vercel tạm `tts-thu-nghiem`, region sin1)
- Trên máy user: đoạn 600 ký tự mất ~22s (quá chậm); đoạn 100-150 ký tự mất ~3-4s cho 6-8s audio.
  ~1/5 lần bị lỗi "Stream closed before the synthesis completed" -> cần tự thử lại.
- Trên Vercel sin1: 132 lần gọi (đoạn 150/300/600 ký tự, song song 2-8), **0 lỗi, 0 lần bị 403**.
  Đoạn 150 ký tự: 0.5-6s; 300 ký tự: 8-17s; 600 ký tự: tới 19s -> đoạn đầu phải nhỏ (~100 ký tự).
- HLS thử thật (playlist VOD + đoạn MP3 thuần, có/không ID3 timestamp): Chrome desktop bắt đầu phát sau
  0.7s, liền mạch; Android (Chrome) OK cả 2 kiểu; iPhone (Safari) OK cả 2 kiểu. Chrome/Android dùng
  hls.js, Safari dùng HLS gốc (Chrome mới báo `canPlayType` HLS = có nhưng KHÔNG phát được MP3 thuần
  -> bắt buộc chọn theo user-agent: Safari/iOS -> native, còn lại -> hls.js).
- Chưa đo: tải quota miễn phí Vercel khi nhiều người nghe; tỉ lệ 403 của Microsoft khi tải thật lớn.
- Code thử nghiệm tham khảo (đã chạy được): thư mục scratchpad `vercel-tts-test/` (api/_lib.js chia đoạn +
  ID3, api/hls/playlist.js, api/hls/seg.js, public/index.html). Dự án Vercel tạm `tts-thu-nghiem`
  (asuo-team) còn giữ để thử; xoá sau khi làm xong (xin user đồng ý trước).

## Kiến trúc

### Luồng chính
1. Bấm "Nghe audio thật" -> `ModalNgheAudioThat` xin playlist HLS của chương hiện tại.
2. Route playlist (server, Next.js route handler trong app chính) kiểm tra quyền rồi trả `playlist.m3u8`
   dạng VOD liệt kê ĐOẠN của **chương hiện tại + tối đa 10 chương kế tiếp** (đoạn chưa tạo, chỉ là URL).
   Chương liên tiếp nối nhau bằng `#EXT-X-DISCONTINUITY` nếu cần.
3. Trình phát (hls.js hoặc HLS gốc) tải đoạn 1 -> route đoạn mới gọi TTS tạo đúng đoạn đó, trả MP3.
   Trình phát tự tải trước vài đoạn kế tiếp. Chỉ đoạn nào được tải mới bị tạo -> playlist dài 11 chương
   không tốn thêm.
4. Đoạn của chương miễn phí được CDN Vercel lưu tạm (`s-maxage=86400`), người sau nghe lại nhanh.
   **Không lưu file audio ở Supabase.**
5. Chữ trên màn hình đổi theo chương đang phát (map giây phát -> chương qua danh sách thời lượng ước tính).
   URL trang cập nhật bằng `window.history.replaceState` như hiện tại.
6. Hết 11 chương trong playlist mà user còn nghe: giữ hành vi hiện có (chuyển chương tại chỗ + xin playlist
   mới); chấp nhận giới hạn "cần bật màn hình" ở ranh giới này.

### Chia đoạn (module thuần, dễ test)
- Cắt văn bản chương theo câu (`. ! ? … ” "` hoặc xuống dòng), đoạn đầu mỗi chương tối đa ~100 ký tự,
  các đoạn sau tối đa ~200 ký tự (đo thật: 200 ký tự ≈ 12-13s audio, tạo ~3-8s -> nhanh hơn phát).
- Tiêu đề chương đọc trước nội dung (như hiện tại: `${tieu_de}. ${noi_dung}`).
- Thời lượng ước tính `EXTINF` = số ký tự / 16.5 (đo: 600 ký tự ≈ 36s). Chỉ ảnh hưởng thanh tua/map
  chương, không ảnh hưởng phát.
- Chia đoạn phải xác định (cùng chương -> luôn ra cùng danh sách đoạn), vì playlist và route đoạn phải khớp.

### Route đoạn (`seg`)
- Tham số: truyện, số chương, chỉ số đoạn (+ vé nếu chương VIP). Lấy văn bản chương từ Supabase bằng
  service role phía server (không lộ ra client), chia đoạn, tạo đoạn thứ i bằng `msedge-tts`
  (giọng `vi-VN-HoaiMyNeural`, MP3 24kHz 96kbps mono như cũ).
- Tự thử lại tối đa 2 lần (tổng 3 lần) khi lỗi/timeout ~25s; vẫn lỗi -> HTTP 502.
- `export const maxDuration = 60` (cần đọc `node_modules/next/dist/docs/` về route handler + cấu hình
  runtime/maxDuration của Next.js phiên bản này trước khi viết — CLAUDE.md nhắc Next.js có breaking changes).
- Runtime Node.js, region đã cấu hình `sin1` trong `vercel.json`.
- Chương miễn phí: `Cache-Control: public, s-maxage=86400, max-age=3600`.
  Chương VIP: `private, no-store` (không CDN dùng chung).

### Quyền truy cập (chặn nghe chùa VIP)
- `SO_CHUONG_FREE = 50` trong `lib/config/goi-vip.ts`. Chương <= 50: ai cũng nghe.
- Chương > 50: route playlist kiểm tra đăng nhập + gói VIP còn hiệu lực (dùng cùng logic gate hiện có:
  RPC `lay_noi_dung_chuong` hoặc `conHieuLucGoi` trong `lib/utils/gia-han-vip.ts`). Không đủ quyền ->
  playlist **dừng ngay trước chương đầu tiên không được nghe** (nếu chương hiện tại đã không được nghe:
  trả 401/403 để modal hiện hướng dẫn đăng nhập/mua gói).
- Đoạn VIP kèm "vé": chữ ký HMAC (bí mật trong biến môi trường Vercel mới, ví dụ `AUDIO_TICKET_SECRET`)
  gắn với truyện + số chương + hạn (vài giờ); route đoạn chỉ kiểm chữ ký/hạn (không gọi DB) -> nhanh.
  Không vé/vé sai/hết hạn -> 403. Chương miễn phí không cần vé.
- Bài học bảo mật cũ: lỗ hổng `xep_hang_tao_audio` cho khách nghe chùa VIP (đã vá) và RLS lộ `noi_dung`
  (đã vá) — route mới KHÔNG được tin tham số client về "chương này miễn phí", phải tự tính lại từ
  `so_chuong` phía server.

### Chống lạm dụng và quá tải
- Dùng Upstash Redis sẵn có (`lib/rate-limit/gioi-han-bot.ts` làm mẫu). Giới hạn theo IP:
  playlist ~10 lần / 10 phút; đoạn ~40 lần / phút (trình phát tải trước vài đoạn nên không thể quá thấp).
  Con số cụ thể chỉnh sau khi đo thật. Quá giới hạn -> 429.
- Giới hạn tổng số đoạn đang được tạo đồng thời toàn site (bộ đếm Upstash, tăng khi bắt đầu, giảm khi xong,
  có TTL phòng kẹt). Vượt ngưỡng (khởi điểm ~20; benchmark cũ: 30 song song ổn, 70 song song ~53% lỗi)
  -> 503 kèm thông báo "Hệ thống đang đông, thử lại sau ít phút" (giống `TTS_RESUME_CCU_LIMIT_EXCEEDED`).
- Upstash lỗi -> fail-open (như rate limit hiện có), không làm sập tính năng.
- Middleware rate limit hiện tại chỉ bảo vệ `/truyen/*`; route mới nằm ngoài nên phải tự gọi rate limit
  trong route, không dựa vào middleware.

### Giao diện / lỗi (sửa luôn lỗi UX cũ)
- Đoạn lỗi sau khi đã thử lại -> modal hiện thông báo lỗi + nút "Thử lại" (không còn spinner vô hạn).
- 503 quá tải -> hiện thông báo quá tải + nút thử lại.
- 401/403 (chưa đăng nhập/chưa có VIP) -> hiện hướng dẫn tương ứng như trang đọc chương.
- Media Session API (điều khiển màn hình khoá) giữ như hiện tại.
- Giữ tách biệt hoàn toàn với nút "Nghe (Giọng máy)" (Web Speech API) — không đụng.

## Thay thế hệ thống cũ (làm theo giai đoạn)
- **Giai đoạn này:** làm mới song song; `ModalNgheAudioThat` chuyển nguồn sang HLS. Code + dữ liệu cũ
  (workflow GitHub Actions `worker-audio-chuong`, bảng `hang_doi_audio`, RPC `xep_hang_tao_audio` /
  `ghi_nhan_nghe_audio`, bucket `audio-chuong`, cột `chuong.audio_url`, `donDepAudioKhongHoatDong`)
  **GIỮ NGUYÊN**, chưa xoá.
- **Sau khi user xác nhận bản mới ổn trên điện thoại:** phiên riêng gỡ code cũ (cần hỏi user trước khi xoá).

## Kiểm thử
- Unit test (vitest, theo pattern hiện có): hàm chia đoạn (biên giới câu, đoạn đầu ngắn, xác định),
  tạo/kiểm chữ ký vé (đúng/sai/hết hạn), tính ranh giới VIP của playlist (free, VIP hợp lệ, chạm ranh giới).
- Kiểm chứng thật qua browser: playlist đúng định dạng, đoạn đầu ra nhanh, chương VIP khách chưa đăng
  nhập bị chặn (curl/anon), giới hạn tốc độ trả 429.
- User tự thử trên điện thoại (Android + iPhone): phát, tắt màn hình, tự chuyển chương.
- Quy tắc dự án: trước khi báo xong phải self code-review diff như kỹ sư (skill `code-review`).

## Ngoài phạm vi (không làm ở lần này)
- Thanh toán PayOS, APK Android, chuyển bucket sang private/signed URL cho audio cũ,
  Turnstile/CAPTCHA chống bot (cân nhắc sau nếu bị lạm dụng thật), gỡ hệ thống audio cũ.

## Rủi ro đã biết
- Microsoft có thể chặn IP (403) khi tải lớn dù thử nhỏ chưa gặp; `msedge-tts` là thư viện không chính thức
  (giống rủi ro cũ). Nếu bị chặn nặng: giảm song song, hoặc chuyển phương án C (VPS trả phí, user để dành).
- Quota Hobby của Vercel (thời gian chạy hàm/lượt gọi) chưa đo thật khi có traffic; theo dõi sau triển khai.
- Đoạn VIP không cache chung -> mỗi lần người dùng VIP nghe lại phải tạo lại (chấp nhận, VIP là thiểu số).
