# Audio khi tắt màn hình + nghiên cứu cách truyendich.space làm audio (2026-09-19)

## Vì sao audio không tự chuyển chương khi tắt màn hình (đã sửa)
- Nguyên nhân gốc: `onEnded` → `chuyenChuongTiepClient()` mới bắt đầu tải chương sau qua mạng
  (Supabase + RPC) VÀ đặt `setTimeout(...,100)` rồi `play()`. Lúc audio vừa kết thúc, trang không còn
  phát nhạc nên điện thoại đóng băng JS/mạng → chuỗi này đứng chờ tới khi bật màn hình.
- Sửa (`ModalNgheAudioThat.tsx`): tải sẵn chương kế tiếp (chữ + audio_url + chương trước/sau) vào
  `chuongKeTiepTaiTruocRef` lúc đang phát (thử lại mỗi 15s tới khi có audio_url); khi `ended` gọi
  `chuyenNgayTuBoNho()` — đổi state bằng `flushSync` (nguồn `<audio>` mới vào DOM ngay) rồi `play()`
  trọn trong sự kiện `ended`, không await mạng. Không đặt `el.src` thủ công vì React set lại `src`
  cùng giá trị sẽ khởi động lại tải và ngắt phát.
- Chưa test trên điện thoại thật. Giới hạn còn lại: chương sau chưa có audio_url lúc hết chương →
  vẫn phải bật màn hình.
- Nút "Nghe (Giọng máy)" (Web Speech API) không sửa được (OS tạm dừng JS). Mẹo phát âm thanh im
  lặng giữ trang sống: chỉ có cơ hội trên Android Chrome, iOS gần như không.

## Cách truyendich.space làm audio (đọc JS công khai; bị chặn Turnstile khi bấm nghe bằng trình
duyệt tự động nên KHÔNG thấy phía máy chủ, và không vượt chốt chặn)
- `POST /api/tts/v2/sessions` body: `slug, chapter_number, edition_type, voice(namminh|hoaimy), rate,
  speed, pitch, volume, bookmark`. Trả về phiên; trang tải `/api/tts/v2/sessions/{id}/playlist.m3u8`.
- Phát dạng luồng HLS: hls.js trên Chrome, HLS gốc (`nativeHls`) trên Safari/iPhone. Header
  `X-TTS-Ready-Until-Media-Index`, `X-TTS-Chapter-Segment-Count`, `X-TTS-Chapter-Estimated-Duration`
  cho thấy chương chia nhiều đoạn, tạo dần, playlist dài ra theo tiến độ → đoạn đầu ~5s là phát.
- Giọng = edge-tts (Nam Minh/Hoài My) cùng loại với mình → khác biệt là kiến trúc, không phải giọng.
- Có `TTS_RESUME_CCU_LIMIT_EXCEEDED` ("Hệ thống đang quá tải lượt nghe, bấm phát lại sau ít phút"),
  Turnstile (`/auth/verify-turnstile`), lọc nội dung nhạy cảm.
- Rút ra: mình chậm vì đợi tạo cả chương (85-127s) qua GitHub Actions (khởi động chậm). Hướng học:
  chia chương thành đoạn nhỏ, tạo đoạn đầu trước, phát dần; cần máy chủ chạy liên tục + giới hạn số
  lượt tạo đồng thời.

## Quyết định của user trong phiên
- Bỏ hướng B (TTS WASM trên trình duyệt) vì render chậm.
- Hướng C (audio thật server) user lo: kẹt khi nhiều người gọi cùng lúc (tự test 2 thiết bị), tốn GB
  Supabase, `msedge-tts` hay lỗi → phát hiện HLS ở trên là hướng có thể giải quyết các nỗi lo này.
- Hướng D (APK Android tải trực tiếp, không CH Play) ghi ở `NEXT_SESSION.md`; APK không chạy trên
  iPhone (cần Apple Developer 99$/năm, chỉ App Store/TestFlight).
