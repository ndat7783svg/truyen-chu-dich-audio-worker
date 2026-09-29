# Nâng cấp giao diện toàn site (2026-09-29)

User duyệt qua phác thảo 3 màn hình điện thoại (trang chủ / trang truyện / trang đọc) trong chat, yêu cầu
Claude tự code (không giao Antigravity), làm xong cho xem bản thử trước, CHƯA deploy production.

## Phạm vi (user chọn)
- Toàn bộ site. Được thêm tính năng nhỏ (mục trang chủ). KHÔNG đụng logic audio, thanh toán, đăng nhập, DB.
- Giữ 3 theme Sáng/Giấy/Tối, giữ nhãn "Dịch" trên bìa (user từng yêu cầu đổi "AI" -> "Dịch").

## Thiết kế
- **Nền chung** (`app/globals.css`): thêm token màu nhấn `accent` / `on-accent` / `accent-soft`, `card`, `rank`
  (cam, xếp hạng), `done` (xanh, "Full") cho cả 3 theme. Phông Be Vietnam Pro (`next/font`, có subset tiếng Việt)
  thay Arial. Tiện ích `no-scrollbar` (trước đó được dùng nhưng chưa định nghĩa).
- **Icon dùng chung** `components/BieuTuong.tsx` (prop `dac` = tô đặc).
- **Header**: dính trên cùng, logo ô màu nhấn, nút Thể loại (bấm để mở trên điện thoại, di chuột trên máy tính),
  ô tìm kiếm luôn hiện trên desktop / icon kính lúp mở ô phủ ngang header trên điện thoại.
- **Thanh điều hướng**: dưới đáy có chữ dưới icon (Trang chủ / Tủ truyện / Tài khoản) cho màn < 1360px; từ 1360px
  là thanh icon dọc bên trái (dưới mốc này thanh dọc chạm mép nội dung rộng 6xl).
- **Trang chủ** (`app/page.tsx` + `components/KhoiTrangChu.tsx`): Truyện nổi bật = truyện mới lên kệ nhất (kèm mô tả)
  | Xem nhiều nhất (top 5 lượt xem) | Đọc tiếp (chỉ khi đăng nhập, từ `tien_do_doc`) | Mới cập nhật (vuốt ngang, theo
  chương có số lớn nhất của từng truyện, dẫn về trang truyện chứ không dẫn thẳng chương mới nhất vì thường là VIP) |
  Thể loại phổ biến (12 thể loại nhiều truyện nhất) | Tất cả truyện (lưới 3/4/5/6 cột). Có từ khoá `q` -> chỉ hiện kết quả.
- **Thẻ truyện**: bỏ nhãn thể loại chật chữ; bìa + nhãn Full/Dịch, tên 2 dòng, "N ch · lượt xem".
- **Trang truyện**: đầu trang nền bìa mờ, bìa + tên + tác giả + 3 số (chương / lượt xem / trạng thái), thể loại,
  nút chính "Đọc tiếp chương X" hoặc "Bắt đầu đọc", nút phụ "Từ đầu", nút Lưu/Đã lưu có chữ. 2 tab Giới thiệu
  (mô tả + ghi chú 50 chương free + 3 chương mới nhất) / Chương (N) (nhóm 50, tự mở nhóm chương đang đọc, đánh dấu
  "Đang đọc"). Link `#danh-sach-chuong` mở thẳng tab Chương. Mục "Truyện cùng thể loại" (ưu tiên trùng nhiều thể loại).
- **Trang đọc**: thanh tiến độ mảnh trên cùng, thanh công cụ có nền theo màu đọc, 3 nút dưới đáy Trước / Danh sách
  (về tab Chương) / Sau hiện-ẩn cùng thanh trên; cuối chương nút Sau màu nhấn, hết chương thì "về trang truyện".
- **Trang phụ**: thể loại, tủ truyện (trạng thái trống có hướng dẫn), tài khoản (avatar chữ cái đầu + nhãn VIP),
  chặn VIP, đăng nhập/đăng ký, hộp chọn gói VIP (dạng bottom sheet trên điện thoại) — chỉ đổi kiểu dáng.

## Sửa lỗi phát sinh
- Trang truyện chỉ hiện tối đa 1000 chương (Supabase trả tối đa 1000 dòng/lần) -> "Đô Thị Chí Tôn" 1626 chương bị
  cắt còn 1000 cả ở số chương lẫn danh sách. Nay lấy nhiều đợt (`layHetChuong`). Lỗi này có sẵn trên production.
