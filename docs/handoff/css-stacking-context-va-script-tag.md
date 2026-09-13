# CSS stacking context & thẻ `<script>` trong JSX

### 2026-09-10 — `opacity < 1` trên 1 thẻ static có thể đè lên phần tử `absolute` đứng TRƯỚC nó
- **Hiện tượng**: nút tròn "Aa" (`position: absolute`, đứng đầu trong DOM) chỉ bấm được nửa dưới,
  nửa trên bấm như "liệt" — dù mắt thường không thấy gì đè lên.
- **Nguyên nhân xác nhận bằng `document.elementFromPoint` thật trong browser**: thẻ `<p
  class="opacity-70">` (tên truyện) đứng SAU nút trong DOM nhưng có `opacity < 1`, theo spec CSS
  điều này tự động biến nó thành 1 stacking-context riêng — cùng nhóm "positioned/stacking-context
  ở stack-level 0" với nút `absolute`. Trong cùng nhóm đó, phần tử đứng SAU trong DOM luôn được vẽ
  ĐÈ LÊN, bất kể phần tử kia là `absolute` hay không. Vùng box (kể cả phần trống không có chữ) của
  `<p>` chặn luôn sự kiện click tại đó dù mắt không thấy nó "che" gì.
- **Cách sửa**: thêm `z-index` tường minh (ví dụ `z-20`) cho phần tử cần luôn nổi lên trên — z-index
  dương thắng tuyệt đối so với z-index `auto`/0, không phụ thuộc thứ tự DOM nữa.
- **Bài học chung**: bất kỳ thẻ nào dùng `opacity`, `transform`, `filter`, hay `will-change` cũng
  tự tạo stacking context mới (không chỉ `position` + `z-index`) — khi thấy 1 vùng bấm không ăn dù
  không có gì che mắt thường, nghi ngay láng giềng có 1 trong các thuộc tính này và kiểm tra bằng
  `document.elementFromPoint(x, y)` thay vì đoán mò qua screenshot.

### 2026-09-11 — Script chống FOUC: dùng `next/script` thay vì `<script dangerouslySetInnerHTML>` thô
- **Hiện tượng**: viết thẳng `<script dangerouslySetInnerHTML={{__html: ...}}>` trong `<head>` của
  `app/layout.tsx` (để set `data-theme` trước khi React hydrate, tránh nhấp nháy trắng rồi mới đổi
  theme) làm React log lỗi console: "Encountered a script tag while rendering React component...".
- **Cách sửa**: đổi sang `<Script id="..." strategy="beforeInteractive">{noiDungScript}</Script>`
  từ `next/script` (built-in của Next.js, không phải cài thêm dependency) — đây là API chính thức
  Next.js khuyến nghị cho đúng use case "chạy script trước khi trang tương tác được".
- **Lưu ý khi kiểm tra lại**: sau khi sửa xong bằng Edit, nếu vẫn thấy lỗi cũ trong console ở tab
  trình duyệt đang mở sẵn — đừng vội kết luận fix chưa ăn. Turbopack/HMR có thể để lại log cũ hoặc
  gây nhiễu tạm thời trong lúc đang hot-reload module. Luôn mở 1 tab hoàn toàn mới rồi load lại
  trang để lấy console log "sạch" thật sự trước khi kết luận còn lỗi hay hết.
- **Không quên `suppressHydrationWarning`**: script này set `data-theme` lên `<html>`/`<body>`
  TRƯỚC khi React hydrate, khiến thuộc tính khác với HTML server render ra (server không biết
  `localStorage` phía client) — phải khai báo `suppressHydrationWarning` trên các thẻ đó để React
  chủ động bỏ qua cảnh báo hydration mismatch dự kiến trước (khác với hydration mismatch KHÔNG
  mong muốn từng gặp ở font `className`, xem lịch sử commit trước đó).
