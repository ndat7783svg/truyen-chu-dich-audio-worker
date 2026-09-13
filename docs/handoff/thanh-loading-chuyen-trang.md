# Thanh loading khi chuyển trang (2026-09-13)

## Vấn đề user phản ánh
User test qua điện thoại thật, thấy bấm vào thẻ truyện/tên chương thì trang "đứng im" một lúc rồi
mới chuyển, không có phản hồi gì — cảm giác web bị đơ/hỏng.

## Chẩn đoán ban đầu SAI, đã tự sửa lại
Claude ban đầu nghi ngờ Next.js `<Link>` tự động prefetch quá nhiều link cùng lúc (đo được 96
request `_rsc=` gần như đồng thời trên trang chủ) gây nghẽn. User phản hồi lại: vấn đề thực sự
không phải độ trễ/nghẽn, mà là **hoàn toàn không có bất kỳ dấu hiệu loading nào** (không giống các
web khác luôn có thanh progress bar/spinner khi chuyển trang) — khiến cùng một độ trễ nhưng cảm
giác như bị treo thay vì "đang tải".

**Bài học**: khi user mô tả "đơ"/"khựng", đừng vội quy về hiệu năng — hỏi lại rõ có phải là "chậm"
hay "không có phản hồi trực quan" (2 vấn đề khác nhau, cách sửa khác hẳn nhau).

## Nguyên nhân thật
Next.js App Router (bản 16.3.4 đang dùng) **không có thanh loading mặc định** khi chuyển route.
Theo tài liệu chính thức (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
mục "What can make transitions slow" → "Dynamic routes without `loading.tsx`"): route động thiếu
file `loading.tsx` khiến client phải đợi server render xong mới thấy bất kỳ thay đổi nào, gây cảm
giác app không phản hồi — đúng y hệt triệu chứng user mô tả.

## Đã sửa (2 phần, làm cả 2 mới đúng gốc rễ)
1. **`loading.tsx` cho từng route động** (`app/loading.tsx`, `app/truyen/[slug]/loading.tsx`,
   `app/truyen/[slug]/chuong/[so]/loading.tsx`, `app/the-loai/[slug]/loading.tsx`) — Next.js tự bọc
   `page.tsx` trong `<Suspense>`, hiện fallback này ngay lập tức khi điều hướng thay vì đợi trắng.
2. **Thanh progress bar chạy ngang trên cùng** (`components/ThanhTienTrinh.tsx`, mount 1 lần ở
   `app/layout.tsx`, bọc `<Suspense>` vì dùng `useSearchParams`) — không dùng thư viện ngoài
   (`nprogress`/`nextjs-toploader`), tự viết bằng cơ chế: lắng nghe `click` trên `document` cho mọi
   thẻ `<a>` cùng-origin (bật thanh), rồi dùng `usePathname()` + `useSearchParams()` đổi giá trị
   (nghĩa là điều hướng đã xong) để tắt thanh.

## Giới hạn đã biết (chưa xử lý, không phải bug)
Cơ chế thanh progress bar chỉ bắt được click vào thẻ `<a>` (tức `next/link`). Các nơi điều hướng
bằng `router.push()` (không qua click `<a>`) — `components/SearchBox.tsx` (tìm kiếm),
`app/dang-nhap/page.tsx`, `components/NutDangXuat.tsx` (đăng xuất) — **sẽ không kích hoạt thanh
loading**. Chưa sửa vì nằm ngoài phạm vi phản hồi ban đầu của user (thẻ truyện/tên chương đều là
`<Link>`, đã có thanh loading đúng). Nếu sau này user báo tương tự ở 3 chỗ trên, cần thêm cách bắt
sự kiện điều hướng dạng `router.push()` (ví dụ 1 context/store dùng chung, gọi thủ công khi bắt đầu
điều hướng).

## Sự cố hạ tầng liên quan (không phải lỗi code)
Trong lúc làm nhiều Task liên tiếp, gọi `npm run build` (production) lặp lại nhiều lần trong khi
`next dev` đang chạy cùng thư mục `.next` khiến dev server bị lỗi **404 cho toàn bộ route động**
(trang tĩnh `/` vẫn OK). Xử lý: `taskkill` process dev cũ, xoá `.next`, khởi động lại dev server
sạch. Sau đó phát hiện thêm nguyên nhân khiến chậm là **WARP bị tắt** (lặp lại sự cố cũ, xem
`moi-truong-va-cong-cu.md`) — bật lại WARP là hết. **Bài học**: tránh chạy `npm run build` nhiều
lần liên tục song song với `next dev` đang chạy trên cùng dự án — ưu tiên chỉ build 1 lần ở bước
kiểm chứng cuối cùng thay vì sau mỗi Task nhỏ.
