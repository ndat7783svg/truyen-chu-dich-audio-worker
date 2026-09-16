# Tính năng "Nghe chương" (Web Speech API) + nghiên cứu TTS tạo file audio thật

## Tính năng "Nghe chương" — đã xong, đã deploy production (2026-09-15/16)

Dùng **Web Speech API** (`SpeechSynthesisUtterance`) có sẵn trong trình duyệt — miễn phí, tức thời,
không cần tạo/lưu file audio. Nút loa cạnh nút "Aa" trong trang đọc chương
(`app/truyen/[slug]/chuong/[so]/PanelDocAudio.tsx`), panel gồm Play/Pause + tốc độ đọc (0.75x-1.5x,
lưu `localStorage` qua `lib/utils/cai-dat-audio.ts`). Đọc hết chương tự động chuyển sang chương sau
và đọc tiếp (cờ `sessionStorage` báo hiệu chương đích cần tự đọc khi mount).

### Bug 1 đã sửa: chia nội dung thành đoạn ngắn trước khi đọc
Đọc nguyên 1 chương dài trong 1 utterance dễ bị Chrome treo/dừng giữa chừng (bug đã biết của
Chrome). Đã tách theo đoạn (dòng trống) rồi tách tiếp theo câu nếu đoạn > 200 ký tự — hàm thuần
`taoDoanDoc()` trong `lib/utils/cai-dat-audio.ts`, có test riêng.

### Bug 2 đã sửa: Tạm dừng/Tiếp tục không đáng tin cậy giữa các trình duyệt
`speechSynthesis.pause()/resume()` gốc hành vi rất khác nhau: desktop hay tự phát lại từ đầu khi
bấm tiếp tục, mobile hay mất hẳn tiếng sau khi resume — đây là bug nổi tiếng của chính Web Speech
API, không phải lỗi code. **Giải pháp**: không dùng `pause()/resume()` gốc — khi bấm "Tạm dừng" thì
tự `cancel()` (huỷ hẳn utterance đang đọc), khi bấm "Tiếp tục" thì tự đọc lại đúng đoạn đang dở
(không dùng `resume()`).

### Bug 3 đã sửa: cờ boolean lọc sự kiện cũ bị kẹt (phát hiện khi tự review lần fix Bug 2)
Ban đầu dùng 1 cờ boolean (`dangChuDongHuyRef`) để phân biệt "chính mình chủ động huỷ" (bỏ qua
onend/onerror) với "audio thật sự dừng" (xử lý bình thường). Vấn đề: `cancel()` **không đảm bảo
luôn bắn sự kiện `onend`/`onerror`** cho utterance bị huỷ ở mọi trình duyệt — nếu không bắn, cờ bị
kẹt mãi ở `true`, khiến MỌI lần đọc xong đoạn sau đó (kể cả đọc thật sự xong, không phải do mình
huỷ) bị hiểu nhầm là chủ động huỷ → audio im lặng dừng sau đúng 1 đoạn, dù state React vẫn báo
"đang đọc". Kiểm chứng qua browser thật bằng cách monkey-patch `speechSynthesis.speak` để log lại
utterance nào thực sự được gọi — thấy rõ hiện tượng dừng sau 1-2 đoạn.

**Giải pháp đúng**: đổi cờ boolean sang **đánh số thế hệ (generation counter)** — `theHeRef` tăng
lên mỗi lần chủ động huỷ; mỗi utterance khi tạo ra ghi nhớ số thế hệ tại thời điểm đó; trong
`onend`/`onerror` so khớp lại số thế hệ hiện tại, khác thì bỏ qua (utterance cũ), không phụ thuộc
việc `cancel()` có bắn sự kiện hay không. Đã kiểm chứng qua browser thật: phát liên tục 5-8 đoạn
không dừng, tạm dừng/tiếp tục nhiều lần vẫn tiếp đúng vị trí.

### Giới hạn đã biết, không sửa được bằng code
**Không nghe được khi tắt màn hình điện thoại** — Web Speech API chạy trên luồng JS của trang, hệ
điều hành tạm dừng JS khi tắt màn hình/rời tab để tiết kiệm pin, không có cách khắc phục cho chính
API này. Đây là đánh đổi đã báo trước cho user khi chọn cách làm miễn phí/tức thời này.

## Nghiên cứu tạo file audio thật (edge-tts) — CHƯA code, mới benchmark thật (2026-09-16)

User hỏi cách các trang lớn (vd truyendich.space, hàng chục nghìn truyện) có audio mọi chương —
brainstorm + benchmark thật (không đoán) trước khi quyết định có làm hay không.

### Vì sao "tắt màn hình vẫn nghe được" cần đổi hẳn cách làm
Đã research xác nhận: chỉ chuyển sang **file audio thật** (`<audio>` + Media Session API để hiện nút
điều khiển màn hình khoá) mới nghe nền được khi tắt màn hình — **Android chạy tốt**, **iOS bị giới
hạn nền tảng của Apple** (PWA cài vào màn hình chính thì audio dừng sau ~30s khi khoá máy; mở thẳng
trên Safari qua tab thường thì đỡ hơn). Không có cách nào giữ Web Speech API chạy nền khi tắt màn
hình.

### Vì sao chọn `edge-tts` (không phải model AI mạnh hơn)
Các model TTS mạnh hơn (Kokoro, Breeze TTS 2, Voxtral...) đều cần GPU riêng (12-16GB VRAM) mới đủ
nhanh — phải thuê máy chủ có GPU (tốn tiền/tháng), trái với ngân sách free tier hiện tại của dự án.
Không có lựa chọn free nào nhanh hơn `edge-tts` (thư viện mã nguồn mở gọi vào dịch vụ Neural TTS
miễn phí của Microsoft Edge, không cần API key, có giọng tiếng Việt tự nhiên) — đây chính là cách đa
số trang audio truyện Việt Nam dùng.

### Benchmark thật (Node.js, package `msedge-tts`, giọng `vi-VN-HoaiMyNeural`, chương thật của
"Tạo Hóa Thôn Thiên Đỉnh", ~7800-17000 ký tự/chương)

| Số chương chạy song song | Kết quả | Thời gian |
|---|---|---|
| 1 (tuần tự) | OK | 127.2s |
| 4 | 4/4 OK | 241.7s tổng (~60s/chương) |
| 10 | 10/10 OK | 261.6s tổng (~26s/chương) |
| 30 | 30/30 OK, không lỗi | 467.1s tổng (1 chương dài gấp đôi kéo dài tổng; 29/30 xong trong 335s) |
| 70 | **37/70 LỖI (~53%)** | 3670.6s — 2 chương treo tới ~61 phút mới báo lỗi (không fail nhanh) |

**Kết luận**: giới hạn an toàn nằm giữa 30 và 70 — tại 70 đã hỏng nặng (không phải "chậm dần đều").
**Khuyến nghị mức song song ~20-30** cho batch job thật, kèm cơ chế tự thử lại khi lỗi. Với truyện
1000 chương: ước tính **~3-4 tiếng chạy nền** (không cần đợi), chấp nhận được so với ước tính ban
đầu (35+ tiếng nếu chạy tuần tự).

### Bug kỹ thuật phát hiện khi test (không phải vấn đề của cách tiếp cận)
`msedge-tts`'s `toFile(dirPath, input)` **không hỗ trợ đặt tên file tuỳ ý** — luôn ghi cố định
`audio.mp3` trong thư mục. Khi test 30 chương song song dùng chung 1 thư mục, các lần ghi đè lẫn
nhau chỉ còn 1 file. **Cách đúng khi code thật**: dùng `toStream()` rồi tự ghi file bằng
`fs.createWriteStream()` với tên tuỳ ý, hoặc mỗi chương ghi vào 1 thư mục riêng.

### Quyết định còn treo (chưa chốt, hỏi lại đầu phiên sau nếu tiếp tục)
1. Audio file thật **thay thế hay bổ sung** nút "Nghe" hiện tại (Web Speech API)?
2. Tạo cho **truyện nào trước** để test thật trên web?
3. Tạo **ngay khi "check" chương mới**, hay chạy **hàng loạt cho kho cũ** trước?
4. Lưu file ở đâu — khả năng cao Supabase Storage giống ảnh bìa (cần tính dung lượng: 1 chương audio
   ~2.5-6MB, 1000 chương ~2.5-6GB — kiểm tra lại giới hạn free tier Supabase Storage trước khi làm
   hàng loạt).
