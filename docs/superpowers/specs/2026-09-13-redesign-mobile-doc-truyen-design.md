# Redesign giao diện mobile-first (thanh điều hướng, trang đọc chương, trang truyện)

## Bối cảnh
User chủ yếu đọc trên điện thoại. Ảnh chụp thực tế cho thấy 3 vấn đề UX trên mobile: thanh điều
hướng icon nổi dọc bên trái đè lên chữ chương khi đọc, Header đầy đủ (logo/thể loại/tìm kiếm) chiếm
không gian không cần thiết trong lúc đọc, và thiếu các lối tắt hữu ích (bắt đầu đọc, danh sách
chương, giới thiệu truyện gọn). Đã brainstorm qua 4 câu hỏi quyết định (xem lịch sử chat
2026-09-13), gộp thành 1 spec vì các phần liên quan chặt tới cùng 1 bố cục mobile.

## Phạm vi — 6 việc

### 1+2. Thanh điều hướng: chuyển xuống đáy trên mobile, ẩn hẳn ở trang đọc chương
- `components/ThanhDieuHuong.tsx`: thêm biến thể responsive.
  - Mobile (`< 768px`, dùng Tailwind breakpoint `md:hidden` / `hidden md:flex`): `fixed bottom-0
    left-0 right-0`, 3 icon (Trang chủ/Tài khoản/Tủ truyện) nằm ngang, căn giữa, nền có viền/shadow
    phân biệt với nội dung bên trên.
  - Desktop (`md:` trở lên): giữ nguyên icon nổi dọc bên trái như hiện tại.
- Ẩn hoàn toàn (cả 2 biến thể) trên route `/truyen/[slug]/chuong/[so]` — xem cơ chế ẩn ở mục 3.

### 3. Trang đọc chương: bỏ Header đầy đủ, sửa bug vị trí nút "Aa"
- **Cơ chế ẩn Header/ThanhDieuHuong theo route**: tạo `components/ChromeToanSite.tsx` (client
  component, dùng `usePathname()`), nhận `header` và `dieuHuong` qua props dạng `ReactNode` (Header
  vẫn là async Server Component, truyền vào như children/props — không đổi thành client). Nếu
  pathname khớp pattern `/truyen/[slug]/chuong/[so]` thì không render 2 phần này. `app/layout.tsx`
  gọi `<ChromeToanSite header={<Header/>} dieuHuong={<ThanhDieuHuong/>}>{children}</ChromeToanSite>`.
- **Thanh top tối giản cho trang đọc chương**: thêm 1 component nhỏ trong `KhungDocChuong.tsx` (hoặc
  file riêng `ThanhTrenChuong.tsx`) gồm: icon nhà bên trái (`Link href="/"`, `fixed top-3 left-3`),
  và nút "Aa" bên phải — thay vị trí `absolute` hiện tại của `PanelCaiDatDoc` bằng `fixed top-3
  right-3` để không bị cuộn trôi/không đè chữ ở mọi kích thước màn hình. Test thật trên viewport
  375px và 320px (Chrome DevTools/Browser pane resize) để xác nhận dropdown cài đặt đọc không bị
  tràn/che nội dung.

### 4. Trang truyện: nút "Bắt đầu đọc"
- `app/truyen/[slug]/page.tsx` đã có sẵn nút "Đọc tiếp Chương N" khi có `tien_do_doc`. Thêm nút
  "Bắt đầu đọc" (→ chương số nhỏ nhất trong `dsChuong`) luôn hiển thị, đặt cạnh nút "Đọc tiếp" (nếu
  có) thành 1 hàng ngang.

### 5. Trang truyện: tách khối "Giới thiệu truyện" + thu gọn/xem thêm
- Bọc `truyen.mo_ta` trong khối riêng có tiêu đề `<h2>Giới thiệu truyện</h2>`.
- Tạo client component `MoTaTruyen.tsx`: mặc định giới hạn hiển thị bằng CSS `line-clamp-4`, kèm
  nút "Xem thêm" (bấm thì bỏ line-clamp, đổi nút thành "Thu gọn"). Chỉ hiện nút khi nội dung thực sự
  dài hơn giới hạn (đo bằng `scrollHeight > clientHeight` sau mount, tránh hiện nút thừa khi mô tả
  ngắn).

### 6. Trang đọc chương: nút "Danh sách chương" + làm nổi bật nút điều hướng chương
- Thêm nút "Danh sách chương" cạnh nút "Aa" (hoặc trong cùng khu vực top), mở dropdown tại chỗ theo
  đúng cơ chế đã có của `PanelCaiDatDoc` (click ngoài để đóng, `absolute`/`fixed` tuỳ vị trí phù hợp)
  — liệt kê toàn bộ chương từ props có sẵn của trang (cần truyền thêm `dsChuong` xuống
  `KhungDocChuong`), có thể cuộn khi danh sách dài, bấm vào điều hướng thẳng tới chương đó.
- Đổi 2 nút "Chương trước"/"Chương sau" (hiện là `<Link>` chữ thường + `hover:underline`) thành nút
  có nền/viền rõ ràng, kích thước đủ lớn để bấm bằng ngón tay (tối thiểu 44px chiều cao theo chuẩn
  touch target).

## Không đổi
- Cơ chế lưu cài đặt đọc (`localStorage`, `cai-dat-doc.ts`) giữ nguyên.
- Theme toàn site 3 chế độ Sáng/Giấy/Tối không đổi.
- Không đổi cấu trúc dữ liệu Supabase (không thêm bảng/cột mới) — mọi dữ liệu cần đã có sẵn
  (`dsChuong`, `tien_do_doc`).

## Kiểm chứng
- Qua Browser pane resize về 375px và 320px (đại diện điện thoại thật):
  - Trang chủ/trang truyện: thanh điều hướng nằm ngang dưới đáy, không đè nội dung.
  - Trang đọc chương: không còn Header đầy đủ, không còn thanh điều hướng nổi; chỉ có icon nhà +
    Aa + (mới) nút Danh sách chương ở trên, cố định không đè chữ khi cuộn.
  - Mở dropdown Aa và dropdown Danh sách chương: không tràn ra ngoài màn hình, không bị chữ chương
    đè lên hoặc đè lên chữ chương.
  - Nút Chương trước/sau rõ ràng, dễ bấm.
  - Trang truyện: có nút "Bắt đầu đọc" luôn hiện; đăng nhập + đã đọc dở thì thêm nút "Đọc tiếp".
  - Khối "Giới thiệu truyện" có tiêu đề, mô tả dài bị cắt kèm nút Xem thêm/Thu gọn hoạt động đúng;
    mô tả ngắn thì không hiện nút thừa.
  - Ở màn hình desktop (`md:` trở lên): thanh điều hướng vẫn giữ kiểu icon nổi dọc bên trái như cũ,
    không có gì thay đổi ngoài việc vẫn ẩn ở trang đọc chương.
- Console sạch lỗi, build + test hiện có (52/52) vẫn pass, không phá vỡ tính năng cũ (lưu truyện,
  lượt xem, chặn copy chương đã làm trước đó).
