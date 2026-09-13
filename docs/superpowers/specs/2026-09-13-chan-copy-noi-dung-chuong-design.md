# Chặn copy nội dung chương (mức cơ bản)

## Bối cảnh
Phát hiện lượng truy cập bất thường (bot crawl hàng trăm chương liên tiếp) sau khi lên
production, khiến user lo ngại nội dung truyện bị sao chép/đăng lại nơi khác. Việc này là bước 1
trong 3 việc bảo mật đã bàn (xem `NEXT_SESSION.md` mục "Việc nhỏ còn tồn đọng" cho 2 việc còn lại:
chặn bot đọc trang, rà soát bảo mật tổng thể).

## Phạm vi
Chỉ áp dụng trong `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx` (khu vực hiển thị nội dung
chương). Không ảnh hưởng trang chủ, trang truyện, tìm kiếm, hay các phần khác của site.

## Cơ chế
Thuần CSS + event handler trên chính khối `<article>` nội dung chương, không thêm dependency:
- `user-select: none` — chặn bôi đen bằng chuột (kéo theo Ctrl+A cũng không chọn được gì).
- Chặn `contextmenu` (chuột phải) trong khối này — không hiện menu ngữ cảnh trình duyệt.
- Chặn sự kiện `copy`/`cut` (khi trình duyệt cố ghi vào clipboard) trong khối này —
  `event.preventDefault()`.
- Không chặn `Ctrl+S` (lưu trang) — không khả thi chặn theo từng khối DOM riêng, và chặn toàn
  trang sẽ ảnh hưởng trải nghiệm ở các phần khác ngoài phạm vi đã chốt. Lưu trang HTML cũng không
  thực sự "copy nhanh" được vì vẫn phải tự trích nội dung ra sau đó.
- Không đổi cách nội dung chương render ra DOM (vẫn text thật, không ảnh hưởng SEO/Google index).

## Giới hạn đã biết (không kỳ vọng quá)
F12 xem source, extension trình duyệt, tool tự động (scraper) vẫn đọc được text — mức này chỉ
chặn thao tác copy tay thông thường của người dùng phổ thông. Chống scraper tự động là việc khác,
đã ghi vào `NEXT_SESSION.md` làm sau.

## Kiểm chứng
- Mở trang đọc chương: bôi đen bằng chuột trong khối nội dung không chọn được chữ.
- Chuột phải trong khối nội dung không hiện menu.
- `Ctrl+C` sau khi cố bôi đen trong khối nội dung không chép được gì vào clipboard (do không chọn
  được text lẫn sự kiện copy bị chặn).
- Các phần khác của trang (header, thanh điều hướng, panel cài đặt đọc) vẫn bôi đen/copy bình
  thường.
- Console sạch lỗi, build + test vẫn pass.
