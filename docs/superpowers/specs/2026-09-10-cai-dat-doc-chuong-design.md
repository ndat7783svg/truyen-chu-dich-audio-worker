# Spec: Cài đặt đọc trong trang chương

Ngày: 2026-09-10

## Mục đích

Cho phép user tự tùy chỉnh giao diện đọc (màu nền, cỡ chữ, phông chữ, giãn dòng) **chỉ bên trong
trang đọc chương** — không ảnh hưởng đến các trang khác của site (trang chủ, trang truyện, Header
chung). Đây là tính năng riêng biệt, không thay thế Task 10 "dark mode toàn site" trong kế hoạch v1
(dark mode toàn site vẫn để bàn sau).

## Phạm vi áp dụng

Toàn bộ khung đọc chương tại `app/truyen/[slug]/chuong/[so]/page.tsx`: breadcrumb (link về trang
truyện), tiêu đề chương, nội dung chương, nav "Chương trước/sau". Không đụng đến Header/Footer
chung của site — các phần đó giữ nguyên giao diện mặc định.

## Kiến trúc

`page.tsx` (Server Component) giữ nguyên toàn bộ phần fetch dữ liệu hiện có (truyện, chương, ghi
lượt xem, chương trước/sau). Phần render JSX (breadcrumb → nav chương sau) được tách ra thành
client component mới, nhận dữ liệu đã fetch qua props.

### Component mới

- **`app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx`** (client component)
  Bọc toàn bộ khu vực đọc. Nhận props: `tenTruyen`, `slugTruyen`, `soChuong`, `tieuDe`, `noiDung`,
  `soChuongTruoc?`, `soChuongSau?`. Quản lý state cài đặt đọc, đọc/ghi `localStorage`, áp dụng màu
  nền/cỡ chữ/phông/giãn dòng qua CSS variables (inline style) lên chính khung này.

- **`app/truyen/[slug]/chuong/[so]/PanelCaiDatDoc.tsx`** (client component)
  Nút bánh răng (hoặc "Aa") nổi ở góc trên-phải khung đọc. Bấm vào mở panel dropdown gồm:
  - Màu nền: 3 nút chọn (Sáng / Vàng / Tối)
  - Cỡ chữ: nút A-/A+ + slider, hiển thị số px hiện tại
  - Phông chữ: 2 nút chọn (Hiện đại / Cổ điển)
  - Giãn dòng: slider, hiển thị giá trị hiện tại

  Nhận state hiện tại + hàm cập nhật từ `KhungDocChuong` qua props (không cần Context vì chỉ dùng
  trong 1 cây component).

`LuuTienDo.tsx` (client component ghi `tien_do_doc`) giữ nguyên, được render bên trong
`KhungDocChuong` hoặc vẫn ở `page.tsx` — không ảnh hưởng bởi thay đổi này.

## State & lưu trữ

```ts
type CaiDatDoc = {
  mauNen: 'sang' | 'vang' | 'toi';
  coChu: number;      // px, 16-32
  phong: 'hien-dai' | 'co-dien';
  giaiDong: number;    // 1.5-2.5
};
```

- Mặc định: `{ mauNen: 'sang', coChu: 18, phong: 'hien-dai', giaiDong: 1.75 }`.
- Lưu vào `localStorage` key `caiDatDocTruyen` (JSON.stringify), đọc lại bằng `useEffect` khi
  `KhungDocChuong` mount. Mỗi lần user đổi 1 cài đặt → cập nhật state + ghi đè `localStorage` ngay.
- Trước khi `useEffect` đọc xong `localStorage` (lần render đầu trên client), dùng giá trị mặc
  định — chấp nhận có thể nháy nhẹ về mặc định đúng 1 khung hình đầu nếu user đã từng đổi cài đặt
  khác mặc định trước đó. Không cần xử lý phức tạp hơn (không dùng cookie/SSR sync) vì quy mô site
  hiện tại nhỏ, trải nghiệm chấp nhận được.
- Không lưu theo tài khoản (Supabase DB) — chỉ lưu trình duyệt hiện tại, áp dụng cho cả khách lẫn
  user đã đăng nhập.

## Giá trị cụ thể

**Màu nền (áp dụng cho toàn khung đọc — nền + màu chữ):**
| Theme | Nền | Chữ |
|---|---|---|
| Sáng | `#ffffff` | `#111827` |
| Vàng (sepia) | `#f4ecd8` | `#5b4636` |
| Tối | `#1a1a1a` | `#e5e5e5` |

**Cỡ chữ:** 16–32px, mặc định 18px, bước nhảy 1px. Áp dụng lên `<article>` nội dung chương (tiêu
đề chương giữ tỷ lệ lớn hơn tương đối, không cần đổi theo px tuyệt đối).

**Phông chữ:**
- Hiện đại = font sans mặc định site hiện tại (không đổi).
- Cổ điển = `Noto Serif` (Google Fonts, qua `next/font/google`, hỗ trợ đầy đủ dấu tiếng Việt).

**Giãn dòng:** 1.5–2.5, mặc định 1.75, bước 0.25. Áp dụng lên `<article>` nội dung chương
(`line-height`).

## Nút mở panel

Icon "Aa" hoặc bánh răng (⚙), không kèm text, dạng nút tròn nổi (`position: sticky` hoặc absolute)
ở góc trên-phải khung đọc — gần vị trí tiêu đề/breadcrumb, tương tự ảnh mẫu tham khảo. Bấm mở
panel dạng dropdown/popover ngay dưới nút; bấm ra ngoài hoặc bấm lại nút để đóng.

## Error handling

- `localStorage` không khả dụng (trình duyệt chặn, chế độ ẩn danh nghiêm ngặt...): bọc đọc/ghi
  trong `try/catch`, lỗi thì bỏ qua lặng lẽ và dùng giá trị mặc định trong phiên đó — không throw,
  không hiện lỗi cho user.
- Giá trị đọc từ `localStorage` không hợp lệ (JSON hỏng, giá trị ngoài khoảng cho phép): dùng giá
  trị mặc định cho phần đó thay vì crash.

## Testing

- Nếu tách hàm đọc/ghi `localStorage` thành hàm thuần riêng (ví dụ `lib/utils/cai-dat-doc.ts`),
  viết unit test cho hàm đó (đọc giá trị hợp lệ, đọc giá trị hỏng → fallback mặc định, ghi rồi đọc
  lại đúng).
- Kiểm chứng bằng tay qua browser thật (Claude tự làm, không cần user):
  1. Mở trang đọc chương, bấm nút cài đặt, đổi từng mục (màu nền, cỡ chữ, phông, giãn dòng) → xem
     áp dụng đúng ngay lập tức.
  2. Reload trang → cài đặt vừa đổi vẫn giữ nguyên (đọc từ `localStorage`).
  3. Kiểm tra tương phản chữ/nền ở cả 3 theme (Sáng/Vàng/Tối) đọc được rõ ràng.
  4. Kiểm tra Header/Footer chung của site không bị ảnh hưởng bởi cài đặt này.
  5. Build sạch (`npm run build`).

## Ngoài phạm vi (không làm trong spec này)

- Dark mode toàn site (Header, trang chủ, trang truyện...) — Task 10 riêng, bàn sau.
- Lưu cài đặt theo tài khoản (đồng bộ nhiều thiết bị) — có thể cân nhắc sau nếu cần.
- 2 nút "DỊCH AI" / "CONVERT" trong ảnh mẫu tham khảo — không thuộc phạm vi, ảnh chỉ để tham khảo
  bố cục panel cài đặt.
