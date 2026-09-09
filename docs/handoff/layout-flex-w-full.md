# Layout: `max-w-* mx-auto` bị co hẹp khi nằm trong `body { flex flex-col }`

### 2026-09-09 — `header`/`main` không giãn hết `max-w-*`, phải thêm `w-full`
- **Vấn đề**: `app/layout.tsx` có `<body className="min-h-full flex flex-col">`. Các trang con
  dùng pattern quen thuộc `className="max-w-3xl mx-auto p-4 ..."` để canh giữa nội dung — pattern
  này hoạt động đúng cho một `<div>`/`<main>` thường, nhưng khi phần tử đó là **con trực tiếp của
  một flex container** (ở đây là `body`), margin `auto` theo trục ngang sẽ **tắt hành vi
  `align-items: stretch`** mặc định — phần tử co lại theo kích thước nội dung (`fit-content`) thay
  vì giãn hết `max-width`.
- **Vì sao khó phát hiện**: `main` của trang chủ (chứa lưới thẻ truyện nhiều cột) tình cờ có nội
  dung đủ rộng để chạm trần `max-w-5xl`, trông như vẫn "full width" bình thường. Chỉ khi `header`
  (ít nội dung: logo + vài link) hoặc `main` ở trạng thái nội dung thưa (vd trang tìm kiếm không có
  kết quả) mới lộ rõ: bị co lại và **canh giữa màn hình** thay vì nằm sát lề trái như ý đồ thiết kế.
- **Cách xử lý**: thêm class `w-full` ngay trước `max-w-*` (vd `"w-full max-w-3xl mx-auto p-4 ..."`)
  cho MỌI phần tử là con trực tiếp của `body` dùng pattern `max-w-* mx-auto` này. `w-full` ép
  `width: 100%` trước, sau đó `max-w-*` mới cắt trần đúng như ý, `mx-auto` canh giữa khối đã đủ
  rộng.
- **Đã sửa** (Đợt A, Task 4): `components/Header.tsx`, `app/page.tsx`.
- **Chưa sửa** (ngoài phạm vi Đợt A, để ý nếu đụng vào sau): `app/dang-ky/page.tsx`,
  `app/dang-nhap/page.tsx`, `app/truyen/[slug]/chuong/[so]/page.tsx` — các trang này chưa được kiểm
  tra lại, có khả năng gặp hiện tượng tương tự nếu nội dung bên trong không đủ rộng để tự chạm trần
  `max-width`.
- Các trang mới viết trong Đợt A (`app/the-loai/[slug]/page.tsx`, `app/truyen/[slug]/page.tsx` bản
  nâng cấp) đã áp dụng `w-full` ngay từ đầu, không bị lỗi này.
