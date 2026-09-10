# Thiết kế: Đăng ký/Đăng nhập nâng cấp — email xác nhận thật + Google

Ngày: 2026-09-10

## Bối cảnh & mục đích
v1 đã có đăng ký/đăng nhập email/mật khẩu đơn giản (`app/dang-ky/page.tsx`,
`app/dang-nhap/page.tsx`) nhưng: không xác nhận email thật, không có tên người dùng, không có
đăng nhập Google, chưa test thủ công xong (Task 9 v1 đang chờ). Bản thiết kế này thay thế/nâng cấp
toàn bộ luồng auth trước khi tiếp tục các tính năng khác.

User có kế hoạch làm tính năng nạp tiền/mua chương sau này — mọi dữ liệu người dùng phải gắn chắc
chắn với tài khoản, không chấp nhận thiết kế tạm bợ ở tầng auth.

## Quyết định kiến trúc: bảng hồ sơ `public.nguoi_dung` (không dùng `user_metadata`)
Theo đúng mẫu Supabase khuyến nghị chính thức ("profiles table pattern"), cũng là cách phổ biến ở
các hệ auth lớn khác (Auth0, Firebase Auth...): tách bạch "danh tính đăng nhập" (`auth.users`, do
Supabase quản lý) và "hồ sơ ứng dụng" (`public.nguoi_dung`, do app quản lý, query/RLS/join bình
thường như mọi bảng khác). Các tính năng sau này (số dư, lịch sử giao dịch, gói đã mua...) sẽ đặt
khoá ngoại thẳng vào `nguoi_dung.id`.

## Data model (Supabase / Postgres) — mới

**`nguoi_dung`**:
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid, PK, references auth.users(id) on delete cascade | Trùng đúng id tài khoản Auth |
| ten_nguoi_dung | text, nullable | Hiển thị ở Header, không bắt buộc phải có |
| tao_luc | timestamptz, not null, default now() | |

RLS: bật, chỉ cho phép user đọc/sửa đúng dòng của chính mình (`auth.uid() = id`), không cho đọc hồ
sơ người khác.

**Trigger tự động tạo hồ sơ khi có tài khoản mới** (chạy khi insert vào `auth.users`, áp dụng cho
cả đăng ký email/mật khẩu lẫn đăng nhập Google lần đầu):
```sql
create table public.nguoi_dung (
  id uuid primary key references auth.users(id) on delete cascade,
  ten_nguoi_dung text,
  tao_luc timestamptz not null default now()
);

alter table public.nguoi_dung enable row level security;

create policy "nguoi dung xem ho so cua chinh minh"
  on public.nguoi_dung for select using (auth.uid() = id);

create policy "nguoi dung sua ho so cua chinh minh"
  on public.nguoi_dung for update using (auth.uid() = id);

create or replace function public.tao_ho_so_nguoi_dung()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nguoi_dung (id, ten_nguoi_dung)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'ten_nguoi_dung',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  );
  return new;
end;
$$;

create trigger khi_co_tai_khoan_moi
  after insert on auth.users
  for each row execute function public.tao_ho_so_nguoi_dung();
```
Ghi chú: `ten_nguoi_dung` lấy từ metadata lúc đăng ký email/mật khẩu (field do form gửi lên qua
`signUp({ options: { data: { ten_nguoi_dung } } })`); nếu đăng nhập Google, Supabase tự đặt sẵn
`full_name`/`name` trong metadata từ profile Google — dùng `coalesce` để không bị trống tên.

## Trang đăng ký (`app/dang-ky/page.tsx`) — viết lại
Form: Tên người dùng (bắt buộc), Email (bắt buộc), Mật khẩu (bắt buộc, tối thiểu 6 ký tự), Xác nhận
mật khẩu (bắt buộc, phải khớp Mật khẩu — kiểm tra phía client trước khi gọi Supabase, báo lỗi
"Mật khẩu xác nhận không khớp" nếu sai, không gọi API).

Submit: `supabase.auth.signUp({ email, password, options: { data: { ten_nguoi_dung } } })`.

Bên dưới nút "Đăng ký": đường kẻ "Hoặc tiếp tục với" + nút "Google" (xem mục Google OAuth).

**Sau khi đăng ký email/mật khẩu thành công**: vì bật "Confirm email" nên chưa có session ngay —
**ẩn form, hiện thông báo tại chỗ**: "Đăng ký thành công! Vui lòng kiểm tra email **{email vừa
nhập}** để xác nhận tài khoản trước khi đăng nhập." Không redirect.

**Lỗi từ Supabase** (vd email đã tồn tại): hiển thị qua hàm dịch lỗi dùng chung (xem mục Xử lý lỗi).

## Trang đăng nhập (`app/dang-nhap/page.tsx`) — sửa
Giữ nguyên form Email/Mật khẩu hiện có, submit vẫn gọi `signInWithPassword`. Thêm bên dưới: đường
kẻ "Hoặc tiếp tục với" + nút "Google" (dùng chung logic với trang đăng ký).

Thành công → `router.push('/')` + `router.refresh()` (giữ nguyên hành vi hiện tại).

## Google OAuth (dùng chung cho cả 2 trang)
Nút "Google": `onClick` gọi
```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```
Đây là điều hướng trình duyệt sang Google, không cần xử lý kết quả tại chỗ (xử lý ở route callback).
Google provider đã được user tự cấu hình xong trên Supabase Dashboard + Google Cloud Console (đã
xác nhận hoàn tất trước khi viết spec này).

## Route callback (mới): `app/auth/callback/route.ts`
Dùng chung cho cả luồng Google OAuth lẫn link xác nhận email Supabase gửi (cả 2 đều redirect về URL
này kèm query `?code=...`, dùng PKCE flow).

```ts
import { NextResponse } from 'next/server';
import { taoSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await taoSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/dang-nhap?loi=xac-nhan-that-bai`);
}
```
Thành công → về thẳng trang chủ, đã đăng nhập (đúng lựa chọn đã chốt). Thất bại → về trang đăng
nhập kèm query báo lỗi, trang đăng nhập đọc query này và hiển thị: "Xác nhận thất bại hoặc đường
dẫn đã hết hạn, vui lòng thử lại."

## Header (`components/Header.tsx`) — sửa
Hiện tại chỉ hiện nút "Đăng xuất" khi có `user`. Sửa: query thêm `nguoi_dung.ten_nguoi_dung` theo
`user.id`, hiển thị "Xin chào, {ten_nguoi_dung}" cạnh nút Đăng xuất (nếu `ten_nguoi_dung` là
`null`, hiện "Xin chào" không kèm tên, không hiện email — tránh lộ email lên UI công khai).

## Xử lý lỗi — hàm dịch lỗi dùng chung
Tạo `lib/utils/dich-loi-supabase.ts`, export `dichLoiSupabase(message: string): string`, map các
message tiếng Anh phổ biến của Supabase Auth sang tiếng Việt:
- `"Invalid login credentials"` → `"Email hoặc mật khẩu không đúng."`
- `"Email not confirmed"` → `"Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản."`
- `"User already registered"` → `"Email này đã được đăng ký."`
- Không khớp message nào ở trên → trả về `"Có lỗi xảy ra, vui lòng thử lại."` (không lộ message kỹ
  thuật gốc ra UI).

Cả trang đăng ký và đăng nhập đều dùng hàm này để hiển thị lỗi từ Supabase, thay vì hiện thẳng
`error.message`.

Lỗi khi gọi `signInWithOAuth` (vd provider chưa bật) → bắt lỗi, hiển thị
`"Không thể đăng nhập bằng Google lúc này, vui lòng thử lại sau."`.

## Giao diện
Theo đúng theme sáng hiện tại của web (không làm riêng bản tối cho 2 trang này — xem thảo luận đã
chốt). Bố cục field giữ đúng tinh thần ảnh tham khảo: label + input viền, nút chính màu xanh, đường
kẻ phân cách "Hoặc tiếp tục với", nút Google viền xám kèm icon chữ G (SVG inline, không tải ảnh
ngoài).

## Testing
- TDD cho `lib/utils/dich-loi-supabase.ts` (hàm thuần, dễ test): test 3 message đã map + 1 message
  lạ trả về câu mặc định.
- Test thủ công qua browser + Supabase Dashboard (user tự làm, Claude không tự bấm submit form
  đăng ký/đăng nhập thật theo quy tắc an toàn của dự án — xem `docs/handoff/an-toan-thao-tac.md`):
  1. Đăng ký bằng email/mật khẩu mới → thấy thông báo "kiểm tra email", **không** vào được trang
     chủ ngay. Kiểm tra Supabase Dashboard → Table Editor → `nguoi_dung`: có dòng mới với
     `ten_nguoi_dung` đúng đã nhập.
  2. Thử đăng nhập ngay bằng tài khoản vừa đăng ký (chưa xác nhận email) → thấy đúng thông báo
     "Email chưa được xác nhận...".
  3. Mở email, bấm link xác nhận → về thẳng trang chủ, Header hiện "Xin chào, {tên}", đăng nhập
     sẵn.
  4. Đăng xuất, đăng nhập lại bằng đúng email/mật khẩu đó → vào được, không báo lỗi xác nhận nữa.
  5. Bấm nút Google ở trang đăng nhập (hoặc đăng ký) → qua màn hình chọn tài khoản Google → về
     trang chủ, đã đăng nhập. Kiểm tra bảng `nguoi_dung` có dòng mới, `ten_nguoi_dung` lấy đúng tên
     từ tài khoản Google.
  6. Nhập sai mật khẩu ở trang đăng nhập → thấy đúng "Email hoặc mật khẩu không đúng.".
  7. Thử đăng ký lại đúng email đã tồn tại → thấy đúng "Email này đã được đăng ký.".

## Việc user cần tự làm trước khi test (đã xác nhận hoàn tất)
- Google Cloud Console: tạo OAuth Client ID (Web application), Authorized redirect URI =
  `https://hijzlcqdtebhjeyuhuov.supabase.co/auth/v1/callback`.
- Supabase Dashboard → Authentication → Providers → Google: bật, dán Client ID/Secret.
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs: thêm
  `http://localhost:3000/auth/callback`.
- **Còn 1 việc cần xác nhận lại trước khi test**: Supabase Dashboard → Authentication → Settings →
  bật "Confirm email" (nếu chưa bật, luồng "chờ xác nhận email" trong thiết kế này sẽ không hoạt
  động đúng — user cần tự kiểm tra/bật trước khi bắt đầu Task test thủ công).

## Ngoài phạm vi
- Đăng nhập bằng nhà cung cấp khác (Facebook, GitHub...) — chỉ Google theo yêu cầu.
- Quên mật khẩu / đặt lại mật khẩu — chưa yêu cầu, bàn sau nếu cần.
- Mã giới thiệu — đã chốt bỏ hẳn khỏi form đăng ký.
- Chỉnh sửa hồ sơ (đổi tên người dùng sau khi đăng ký) — chưa có UI, để sau.
