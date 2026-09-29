# Nâng cấp giao diện toàn site + audit bảo mật chương VIP (2026-09-29)

## Audit bảo mật VIP (chỉ đọc, không có lỗ hổng mới)
Thử khai thác thật bằng anon key + curl production, vai người chưa trả tiền:
- REST `chuong?select=noi_dung` / `select=*` / nhúng `truyen?select=chuong(noi_dung)` / lọc `noi_dung=like.*a*`
  (dò từng chữ) / `order=noi_dung` -> đều 401 `42501`.
- RPC `lay_noi_dung_chuong` chương VIP -> `null`; chương free -> có nội dung.
- `giao_dich`, `nguoi_dung` -> `[]`.
- Trang chương 120 khi chưa đăng nhập (HTML thường, kiểu RSC `RSC: 1`, prefetch) -> so 3 câu của nội dung thật: KHÔNG
  câu nào có trong phản hồi; có redirect `/dang-nhap` (HTTP 200 vì Suspense streaming, đã biết).
- Audio: manifest/playlist VIP -> 403; đoạn VIP không vé / vé giả -> 403; manifest chương 45 không lộ vé VIP.
- **Chưa thử thật**: tự sửa `goi_het_han` qua PATCH `nguoi_dung` — công cụ an toàn của Claude chặn lệnh ghi thử lên
  DB thật (hợp lý: nếu hàng rào hỏng sẽ sửa thật dữ liệu). Chỉ xác minh qua code: trigger `chan_tu_sua_goi_vip`,
  không có policy insert/delete cho `nguoi_dung`. Muốn chắc chắn: user tự xem trong Supabase Dashboard > Database >
  Triggers có `truoc_khi_sua_nguoi_dung`.
- Giới hạn không chặn được bằng kỹ thuật: người đã trả tiền copy chữ, cho mượn tài khoản.

## Giao diện — bài học
- Công cụ chụp màn hình của trình duyệt nhúng hay chụp lệch/lặp khung ở chế độ giả lập điện thoại, và khi khung
  ẩn thì `getBoundingClientRect()` trả 0 -> đừng kết luận "lỗi bố cục" từ 2 nguồn này; đo `scrollWidth`,
  toạ độ `main` lúc khung đang hiện.
- `@theme inline` Tailwind v4: thêm màu mới chỉ cần biến CSS theo từng `data-theme` + ánh xạ `--color-*`.
- Prop tên `to` trên component bọc `<svg>` đụng thuộc tính SVG `to` (kiểu `string|number`) -> lỗi TS khó hiểu; đổi tên.
- Menu mở bằng `onMouseEnter` + nút `onClick` toggle: trên Android cú chạm bắn "mouseover" rồi "click" -> mở rồi đóng
  ngay. Dùng `onPointerEnter` lọc `pointerType === 'mouse'`, nút bấm chỉ mở (đóng bằng bấm ra ngoài).
- Supabase/PostgREST trả tối đa 1000 dòng/lần: mọi truy vấn "lấy hết chương" phải phân trang `.range()`.
- Còn nợ: trang chủ hỏi DB 1 lần/truyện cho mục "Mới cập nhật" (N+1). 20 truyện ổn; kho lớn nên tạo view
  `max(so_chuong), max(created_at)` theo truyện (cần chạy SQL).
- 9 lỗi eslint `set-state-in-effect`/`immutability` còn lại là code cũ (ChonTheme, PanelDocAudio, dang-nhap...), không đổi.
