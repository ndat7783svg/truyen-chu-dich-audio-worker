# HANDOFF.md — Mục lục nhật ký kỹ thuật

Nội dung thật nằm trong `docs/handoff/<chủ-đề>.md` (append-only, tách theo chủ đề/tính năng —
KHÔNG theo buổi làm việc). File này chỉ liệt kê chủ đề đang có.

| Chủ đề | File | Mô tả |
|---|---|---|
| An toàn thao tác test | [docs/handoff/an-toan-thao-tac.md](docs/handoff/an-toan-thao-tac.md) | Không tự submit form đăng ký/đăng nhập thật (= tạo tài khoản) |
| Môi trường & công cụ | [docs/handoff/moi-truong-va-cong-cu.md](docs/handoff/moi-truong-va-cong-cu.md) | BOM trong `.env.local`, chạy sync script cần `--env-file`, ISP chặn domain (không phải lỗi code) |
| Dữ liệu thật & parse chương | [docs/handoff/du-lieu-va-parse-chuong.md](docs/handoff/du-lieu-va-parse-chuong.md) | Số chương thật lệch design doc, bug `parseChuong` bị test bắt trước khi commit |
