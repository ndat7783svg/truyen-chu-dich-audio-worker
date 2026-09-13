# Thiết kế: Header full-width theo mẫu truyendich.ai + đổi tên site

Ngày: 2026-09-13
Trạng thái: đã duyệt qua brainstorming, chờ viết plan implementation.

## Mục tiêu
Bố cục Header hiện tại (`max-w-3xl mx-auto`, thu hẹp, ô tìm kiếm nằm riêng ở trang chủ) chưa giống
cách trình bày của truyendich.ai (logo sát trái, menu Thể loại cạnh logo, ô tìm kiếm to sát phải,
header trải hết chiều rộng màn hình). Đồng thời đổi tên hiển thị của web từ "Truyện dịch AI" sang
**"Truyện chữ dịch"** (tên chính thức user chọn).

## Phạm vi
- Redesign `components/Header.tsx`: full-width, gộp logo + Thể loại + ô tìm kiếm vào 1 thanh.
- Di chuyển `components/SearchBox.tsx` từ `app/page.tsx` vào `Header.tsx` (dùng chung mọi trang).
- Đổi tên hiển thị "Truyện dịch AI" → "Truyện chữ dịch" ở Header + `metadata.title` trong
  `app/layout.tsx` (hiện đang là "Create Next App" mặc định, chưa từng sửa).
- Bỏ `<h1>Truyện dịch AI</h1>` lặp lại trên trang chủ (Header đã đảm nhiệm việc hiển thị tên site).
- **Không đụng** `components/ThanhDieuHuong.tsx` (thanh icon nổi Trang chủ/Tài khoản/Tủ truyện) —
  ngoài phạm vi yêu cầu.

## Thiết kế chi tiết

### `components/Header.tsx`
- Container: `w-full border-b border-border bg-surface` (bỏ `max-w-3xl mx-auto`), bên trong 1 hàng
  `flex flex-wrap items-center justify-between gap-3 px-4 py-3`.
- Cụm trái: `<Link href="/">` chứa icon sách (SVG inline, không thêm thư viện) + chữ
  "Truyện chữ dịch" (`font-bold text-lg`), cạnh đó là `<DropdownTheLoai>` (component không đổi
  logic, chỉ có thể chỉnh khoảng cách `gap`).
- Cụm phải: `<SearchBox defaultValue="" />` bọc trong `div` có `flex-1 min-w-[200px] max-w-md`
  (co giãn nhưng không quá to trên màn hình rộng).
- Trên màn hình hẹp, `flex-wrap` cho phép cụm tìm kiếm tự xuống hàng dưới, chiếm full width hàng
  đó — không cần media query riêng.
- `Header` vẫn là async server component (giữ nguyên fetch `the_loai` hiện có).

### `components/SearchBox.tsx`
- Giữ nguyên toàn bộ logic (`useState`, `router.push('/?q=...')`).
- Chỉnh class cho gọn trong header: input `text-sm px-3 py-1.5 rounded-full border border-border
  bg-background flex-1`, nút "Tìm" `text-sm px-4 py-1.5 rounded-full bg-blue-600 text-white`.
- `defaultValue` truyền `""` khi gọi từ Header (Header không có `searchParams` — đây là hành vi
  chấp nhận được: sau khi tìm và điều hướng, trang chủ tự đọc lại `q` từ URL và set giá trị ô tìm
  kiếm qua re-render toàn trang, không mất giá trị đang gõ giữa chừng vì `SearchBox` đã nằm trong
  `Header` được render lại cùng lúc với `page.tsx` mỗi lần chuyển route).

### `app/page.tsx`
- Xoá `<h1 className="text-2xl font-bold mb-4">Truyện dịch AI</h1>`.
- Xoá `<SearchBox defaultValue={q ?? ''} />` và import `SearchBox` (không dùng nữa ở đây).
- Phần còn lại (lưới `TheTruyen`, thông báo rỗng) giữ nguyên.

### `app/layout.tsx`
- Đổi `title: "Create Next App"` thành `title: "Truyện chữ dịch"` trong `export const metadata`.

## Không làm trong lần này
- Không thêm mục "Danh sách" (dropdown thứ 2 trong ảnh mẫu truyendich.ai) — trang này chưa có khái
  niệm tương ứng.
- Không đổi `ThanhDieuHuong.tsx`.
- Không đổi bố cục nội dung trang chủ (lưới truyện, các section như "Dịch bởi AI"/"Truyện Full"
  trong ảnh mẫu) — chỉ Header.

## Testing
- Không có unit test riêng (thay đổi thuần UI/layout, không có logic mới ngoài việc di chuyển
  component đã có sẵn `SearchBox`).
- Chạy `npm run build` + `npx vitest run` để đảm bảo không phá vỡ gì hiện có.
- Kiểm chứng thật qua browser (Claude tự làm): Header full-width đúng trên mọi trang (`/`,
  `/truyen/[slug]`, `/tu-truyen`, `/tai-khoan`, `/the-loai/[slug]`), tìm kiếm từ Header hoạt động
  đúng (gõ tên truyện, bấm Tìm, điều hướng về `/` với kết quả lọc đúng), dropdown Thể loại vẫn hoạt
  động, tiêu đề tab trình duyệt hiện "Truyện chữ dịch", trang chủ không còn dòng tiêu đề lặp, xuống
  màn hình hẹp (mobile width) header không vỡ layout, console sạch lỗi.
