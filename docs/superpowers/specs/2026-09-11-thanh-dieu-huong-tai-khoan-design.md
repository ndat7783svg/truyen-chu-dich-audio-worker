# Thanh điều hướng + Trang Tài khoản + Theme toàn site — Design

Ngày: 2026-09-11

## Bối cảnh

Người dùng đưa 2 ảnh chụp từ website tham khảo `truyendich.space` (trang `/tai-khoan` và
`/tu-truyen`) làm nguồn cảm hứng UX: một thanh điều hướng dạng icon nổi bên trái, dẫn tới trang
"Tài khoản" (hồ sơ + đổi giao diện) và trang "Tủ truyện" (lịch sử đọc/đã lưu/đã thêm).

Yêu cầu gốc: thêm 3 nút điều hướng dạng icon (Trang chủ, Tài khoản, Tủ truyện), tự chọn vị trí phù
hợp, và thiết kế luôn nội dung bên trong các trang đó — không chỉ làm nút suông.

Qua brainstorming, đã quyết định chia làm 2 đợt:
- **Đợt này**: thanh điều hướng đủ 3 nút + trang Tài khoản đầy đủ (gồm cả theme toàn site — hoàn
  tất dứt điểm Task 10 dark mode còn treo từ v1) + trang Tủ truyện tạm "Sắp ra mắt".
- **Đợt sau** (riêng, chưa bàn thiết kế): nội dung thật của Tủ truyện (3 tab Đã đọc/Đã lưu/Đã
  thêm) — cần thêm tính năng lưu truyện (bookmark) chưa có.

## Quyết định đã chốt qua brainstorming

1. **Cấp độ thành viên**: chỉ là nhãn tĩnh "Thành viên" hiển thị cho mọi user đã đăng nhập, không
   có hệ thống phân cấp thật. Dễ nâng cấp thành thật (VIP/nạp tiền) sau này mà không phải thiết kế
   lại giao diện.
2. **Quan hệ giữa 2 theme**: theme toàn site (Sáng/Giấy/Tối) và cài đặt đọc trong trang chương
   (màu nền Sáng/Vàng/Tối ở `lib/utils/cai-dat-doc.ts`) là **2 hệ thống độc lập hoàn toàn**, không
   ảnh hưởng lẫn nhau. Giữ nguyên logic cài đặt đọc hiện có.
3. **Nút Tủ truyện đợt này**: hiện đủ trên thanh điều hướng ngay, nhưng dẫn tới trang tạm ghi "Sắp
   ra mắt" — chưa có nội dung thật.
4. **Header hiện tại**: bỏ hẳn khối đăng nhập/đăng ký/"Xin chào {tên}"/đăng xuất khỏi `Header.tsx`
   — toàn bộ vai trò đăng nhập/đăng xuất chuyển sang trang Tài khoản. Header chỉ còn logo +
   dropdown "Thể loại".
5. **Kỹ thuật theme**: tự làm bằng `localStorage` + biến CSS (không dùng thư viện `next-themes`,
   không thêm dependency mới) — đồng bộ phong cách với `cai-dat-doc.ts` đã có.
6. **Phạm vi áp dụng theme**: áp dụng toàn site ngay đợt này (Header, trang chủ, `TheTruyen`, trang
   truyện, trang thể loại, đăng nhập, đăng ký) — hoàn tất dứt điểm Task 10 dark mode, không để nợ
   lại.

## Kiến trúc

### 1. Thanh điều hướng — `components/ThanhDieuHuong.tsx`

- Client component, `position: fixed` bên trái màn hình (ví dụ `left-4 top-1/2 -translate-y-1/2`),
  nổi trên mọi trang, `z-index` cao hơn mọi nội dung khác.
- 3 icon dạng nút tròn xếp dọc: **Trang chủ** (`/`), **Tài khoản** (`/tai-khoan`), **Tủ truyện**
  (`/tu-truyen`). Dùng icon SVG inline đơn giản (nhà, người, sách) — không thêm thư viện icon mới.
- Hover vào 1 icon → hiện tooltip tên bên cạnh (ví dụ dùng `group-hover` của Tailwind).
- Icon ứng với trang đang mở được tô đậm (dùng `usePathname()` từ `next/navigation` so khớp
  đường dẫn hiện tại).
- Gắn 1 lần trong `app/layout.tsx`, cạnh `<Header />`, hiển thị trên mọi trang.
- Không cần responsive đặc biệt cho mobile ở đợt này (giữ nguyên vị trí cố định bên trái, đơn giản
  hoá theo YAGNI — nếu sau này thấy che nội dung trên màn hình nhỏ thì điều chỉnh riêng).

### 2. Hệ thống theme toàn site

**`app/globals.css`** — mở rộng khối biến CSS hiện có, thêm theo 3 theme:

```css
:root {
  --mau-nen: #ffffff;
  --mau-nen-phu: #f9fafb;   /* card/surface */
  --mau-chu: #171717;
  --mau-chu-phu: #6b7280;   /* text phụ/mờ */
  --mau-vien: #e5e7eb;
}

:root[data-theme='giay'] {
  --mau-nen: #f4ecd8;
  --mau-nen-phu: #ece0c6;
  --mau-chu: #5b4636;
  --mau-chu-phu: #8a7360;
  --mau-vien: #d9c9a8;
}

:root[data-theme='toi'] {
  --mau-nen: #1a1a1a;
  --mau-nen-phu: #262626;
  --mau-chu: #e5e5e5;
  --mau-chu-phu: #a3a3a3;
  --mau-vien: #3f3f3f;
}

@theme inline {
  --color-background: var(--mau-nen);
  --color-surface: var(--mau-nen-phu);
  --color-foreground: var(--mau-chu);
  --color-muted-foreground: var(--mau-chu-phu);
  --color-border: var(--mau-vien);
}
```

Bỏ khối `@media (prefers-color-scheme: dark)` cũ (không dùng nữa, thay bằng `data-theme` tường
minh do người dùng chọn).

**`lib/utils/theme.ts`** (mới, pattern giống hệt `cai-dat-doc.ts`):
- `export type ThemeToanSite = 'sang' | 'giay' | 'toi'`
- `docTheme()` / `ghiTheme()` đọc/ghi `localStorage` khóa `themeToanSite`, chuẩn hoá dữ liệu hỏng
  về mặc định `'sang'`.

**Tránh FOUC**: thêm 1 thẻ `<script>` inline (không dùng `next/script`, chèn trực tiếp
`dangerouslySetInnerHTML` trong `<head>` của `app/layout.tsx`) chạy đồng bộ trước khi React
hydrate — đọc `localStorage.themeToanSite`, set `document.documentElement.dataset.theme` ngay lập
tức. Bọc trong `try/catch` phòng khi `localStorage` không khả dụng (SSR/trình duyệt chặn).

**`components/ChonTheme.tsx`** (mới, client component dùng trong trang Tài khoản): 3 nút
Sáng/Giấy/Tối, bấm vào gọi `ghiTheme()` + set `document.documentElement.dataset.theme` ngay để áp
dụng tức thì (không cần reload).

**Cập nhật các file hiện có** sang dùng class theme-token thay vì màu cứng Tailwind
(`bg-white`→`bg-background`, `text-gray-900`→`text-foreground`, `border-gray-*`→`border-border`,
`bg-gray-100` hover→`bg-surface`, v.v.):
- `components/Header.tsx`
- `components/TheTruyen.tsx`
- `components/DropdownTheLoai.tsx`
- `app/page.tsx`
- `app/the-loai/[slug]/page.tsx`
- `app/truyen/[slug]/page.tsx`
- `app/dang-ky/page.tsx`, `app/dang-nhap/page.tsx`

Lưu ý: **không đụng** `app/truyen/[slug]/chuong/[so]/KhungDocChuong.tsx` và `PanelCaiDatDoc.tsx` —
trang đọc chương giữ nguyên hệ màu riêng (`mauSacTheo` từ `cai-dat-doc.ts`), độc lập với theme toàn
site theo quyết định đã chốt.

### 3. Trang Tài khoản — `app/tai-khoan/page.tsx`

Server component, đọc user hiện tại qua `taoSupabaseServerClient()` (giống `Header.tsx` đang làm).

- **Đã đăng nhập**: card hiển thị avatar mặc định (ảnh tĩnh, chưa có tính năng upload), tên (từ
  `nguoi_dung.ten_nguoi_dung`), email, dòng "Cấp độ: Thành viên" (text tĩnh), nút "Đăng xuất"
  (dùng lại `NutDangXuat.tsx` hiện có).
- **Chưa đăng nhập**: thay card trên bằng thông báo ngắn + 2 nút "Đăng nhập" / "Đăng ký" (link tới
  `/dang-nhap`, `/dang-ky`).
- Mục "Giao diện": card chứa `<ChonTheme />`.
- Mục "Cài đặt": card tĩnh, chữ mờ "Sắp ra mắt", không có chức năng.

### 4. Trang Tủ truyện — `app/tu-truyen/page.tsx`

Page tĩnh đơn giản: tiêu đề "Tủ truyện" + dòng chữ "Sắp ra mắt, đang phát triển". Không cần đăng
nhập để xem trang tạm này (tránh chặn nhầm khi nội dung thật chưa có).

### 5. `components/Header.tsx`

Bỏ toàn bộ khối `{user ? ... : ...}` (Xin chào/đăng xuất hoặc đăng nhập/đăng ký) và import
`NutDangXuat` không còn cần trong Header nữa (vẫn giữ file `NutDangXuat.tsx` vì trang Tài khoản
dùng lại). Header chỉ còn logo (`Link href="/"`) + `<DropdownTheLoai />`. Vẫn giữ Header là async
server component vì `DropdownTheLoai` cần danh sách thể loại từ Supabase — nhưng không cần query
`user`/`nguoi_dung` nữa (xoá đoạn code đó).

## Kiểm chứng

- `npm run build` sạch, `npx vitest run` (test hiện có của `cai-dat-doc.ts` không bị ảnh hưởng vì
  không đụng file đó).
- Kiểm chứng thật qua browser: thanh điều hướng hiện đúng 3 icon + tooltip hover + active state;
  bấm đổi theme ở trang Tài khoản → toàn bộ trang chủ/trang truyện/trang thể loại đổi màu ngay,
  không cần reload; reload lại trang vẫn giữ theme đã chọn (đọc từ `localStorage`, không FOUC);
  trang đọc chương không bị ảnh hưởng bởi theme toàn site; Header không còn đăng nhập/đăng
  xuất; trang Tủ truyện hiện "Sắp ra mắt"; trang Tài khoản hiện đúng theo trạng thái đăng
  nhập/chưa đăng nhập.
- Không cần viết test tự động mới cho phần UI thuần hiển thị (theo pattern dự án đã áp dụng cho
  các tính năng UI trước — chỉ TDD cho module logic thuần như `theme.ts`, phần còn lại kiểm chứng
  bằng browser thật).

## Ngoài phạm vi (không làm đợt này)

- Nội dung thật của Tủ truyện (tab Đã đọc/Đã lưu/Đã thêm, tính năng lưu truyện).
- Cấp độ thành viên thật (VIP/nạp tiền).
- Upload avatar.
- Responsive riêng cho thanh điều hướng trên mobile.
- Mục "Cài đặt chung" trong trang Tài khoản.
