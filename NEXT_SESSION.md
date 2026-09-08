# NEXT_SESSION.md

## Đang làm dở: Brainstorming thiết kế website (chưa có code)

Đang theo skill `superpowers:brainstorming`. Tiến độ:

- [x] Khảo sát dự án nguồn `D:\translate truyen` (cấu trúc: mỗi truyện 1 folder trong
      `danh-sach-truyen/`, mỗi chương 1 file `.md`, có sẵn audio TTS cho 1 số chương).
- [x] Chốt đối tượng dùng: công khai cho mọi người, domain free Vercel, có đăng ký/đăng nhập,
      mục trả phí mua chương **bàn sau** (chưa code).
- [x] Chốt tính năng v1: đọc chữ (chưa audio), lưu tiến độ đọc, tìm kiếm, dark mode.
- [x] Chốt kiến trúc: **Hướng A** — Next.js + Vercel + Supabase (Postgres + Auth). User đã đồng ý.
- [x] Tạo bộ file quản lý ngữ cảnh (`CLAUDE.md`, `PROJECT_MAP.md`, `HANDOFF.md`, `NEXT_SESSION.md`)
      theo yêu cầu user, trước khi code.
- [ ] **Bước tiếp theo**: trình bày nốt phần thiết kế còn lại trong brainstorming — cụ thể:
      - Data model (bảng `truyen`, `chuong`, `nguoi_dung`, `tien_do_doc` trong Supabase).
      - Cơ chế đồng bộ "check [tên truyện]": Claude đọc file `.md` từ `D:\translate truyen`, so
        sánh với DB, đăng chương mới (kèm hỏi bổ sung mô tả/ảnh bìa nếu là truyện mới hoàn toàn).
      - Trang/route chính, xử lý lỗi cơ bản, cách test.
      Sau khi user duyệt design → viết design doc vào
      `docs/superpowers/specs/YYYY-MM-DD-website-truyen-design.md`, tự rà soát, rồi mới hỏi user
      review spec → chuyển sang skill `writing-plans`.

## Quyết định đang chờ user
- Chưa có câu hỏi nào đang chờ — sẽ hỏi tiếp trong lúc trình bày phần data model/đồng bộ nếu có
  điểm chưa rõ (vd: mô tả/ảnh bìa truyện lấy từ đâu khi đăng truyện mới).
