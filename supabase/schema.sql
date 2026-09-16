create extension if not exists pgcrypto;

create table truyen (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  slug text not null unique,
  mo_ta text,
  anh_bia text,
  trang_thai text not null default 'dang-ra' check (trang_thai in ('dang-ra', 'hoan-thanh')),
  created_at timestamptz not null default now()
);

create table chuong (
  id uuid primary key default gen_random_uuid(),
  truyen_id uuid not null references truyen(id) on delete cascade,
  so_chuong int not null,
  tieu_de text not null,
  noi_dung text not null,
  created_at timestamptz not null default now(),
  unique (truyen_id, so_chuong)
);

create table tien_do_doc (
  user_id uuid not null references auth.users(id) on delete cascade,
  truyen_id uuid not null references truyen(id) on delete cascade,
  chuong_id uuid not null references chuong(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, truyen_id)
);

alter table truyen enable row level security;
alter table chuong enable row level security;
alter table tien_do_doc enable row level security;

create policy "truyen doc cong khai" on truyen for select using (true);
create policy "chuong doc cong khai" on chuong for select using (true);

create policy "user xem tien do cua minh" on tien_do_doc
  for select using (auth.uid() = user_id);
create policy "user tao tien do cua minh" on tien_do_doc
  for insert with check (auth.uid() = user_id);
create policy "user sua tien do cua minh" on tien_do_doc
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Đợt A (2026-09-09): ảnh bìa, tác giả, thể loại
alter table truyen add column tac_gia text;

create table the_loai (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  slug text not null unique
);

create table truyen_the_loai (
  truyen_id uuid not null references truyen(id) on delete cascade,
  the_loai_id uuid not null references the_loai(id) on delete cascade,
  primary key (truyen_id, the_loai_id)
);

alter table the_loai enable row level security;
alter table truyen_the_loai enable row level security;

create policy "the_loai doc cong khai" on the_loai for select using (true);
create policy "truyen_the_loai doc cong khai" on truyen_the_loai for select using (true);

insert into storage.buckets (id, name, public)
values ('anh-bia', 'anh-bia', true)
on conflict (id) do nothing;

-- Đợt B (2026-09-10): Lượt xem truyện & chương
alter table truyen add column if not exists luot_xem integer not null default 0;
alter table chuong add column if not exists luot_xem integer not null default 0;

create table if not exists luot_xem_da_doc (
  visitor_key text not null,
  chuong_id uuid not null references chuong(id) on delete cascade,
  tao_luc timestamptz not null default now(),
  primary key (visitor_key, chuong_id)
);

alter table luot_xem_da_doc enable row level security;

-- Hàm RPC ghi nhận lượt xem nguyên tử, chống trùng vĩnh viễn theo visitor_key + chuong_id
create or replace function ghi_luot_xem(
  p_visitor_key text,
  p_chuong_id uuid,
  p_truyen_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into luot_xem_da_doc (visitor_key, chuong_id)
  values (p_visitor_key, p_chuong_id)
  on conflict (visitor_key, chuong_id) do nothing;

  -- Chỉ tăng số đếm nếu insert ở trên thực sự tạo ra dòng mới (chưa từng đọc chương này)
  if found then
    update chuong
    set luot_xem = luot_xem + 1
    where id = p_chuong_id;

    update truyen
    set luot_xem = luot_xem + 1
    where id = p_truyen_id;
  end if;
end;
$$;

-- Đợt C (2026-09-10): Hồ sơ người dùng & trigger tự động tạo hồ sơ
create table if not exists public.nguoi_dung (
  id uuid primary key references auth.users(id) on delete cascade,
  ten_nguoi_dung text,
  tao_luc timestamptz not null default now()
);

alter table public.nguoi_dung enable row level security;

drop policy if exists "nguoi dung xem ho so cua chinh minh" on public.nguoi_dung;
create policy "nguoi dung xem ho so cua chinh minh"
  on public.nguoi_dung for select using (auth.uid() = id);

drop policy if exists "nguoi dung sua ho so cua chinh minh" on public.nguoi_dung;
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

drop trigger if exists khi_co_tai_khoan_moi on auth.users;
create trigger khi_co_tai_khoan_moi
  after insert on auth.users
  for each row execute function public.tao_ho_so_nguoi_dung();

-- Tính năng "Đã lưu" (2026-09-13): bookmark truyện
create table if not exists truyen_da_luu (
  nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
  truyen_id uuid not null references truyen(id) on delete cascade,
  luu_luc timestamptz not null default now(),
  primary key (nguoi_dung_id, truyen_id)
);

alter table truyen_da_luu enable row level security;

drop policy if exists "user xem truyen da luu cua minh" on truyen_da_luu;
create policy "user xem truyen da luu cua minh" on truyen_da_luu
  for select using (auth.uid() = nguoi_dung_id);

drop policy if exists "user luu truyen cho minh" on truyen_da_luu;
create policy "user luu truyen cho minh" on truyen_da_luu
  for insert with check (auth.uid() = nguoi_dung_id);

drop policy if exists "user bo luu truyen cua minh" on truyen_da_luu;
create policy "user bo luu truyen cua minh" on truyen_da_luu
  for delete using (auth.uid() = nguoi_dung_id);

-- Hệ thống gói VIP (2026-09-13, bản thủ công v1 — chưa tích hợp PayOS)
alter table nguoi_dung add column if not exists goi_loai text;
alter table nguoi_dung add column if not exists goi_het_han timestamptz;

-- Chặn user tự sửa gói VIP của mình qua API thường (chỉ service role key mới sửa được, dùng trong
-- scripts/xac-nhan-thanh-toan.mjs) — chính sách update sẵn có của nguoi_dung cho phép user sửa hồ
-- sơ của chính mình, nếu không có trigger này họ có thể tự set goi_het_han bất kỳ.
create or replace function public.chan_tu_sua_goi_vip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.goi_loai := old.goi_loai;
    new.goi_het_han := old.goi_het_han;
  end if;
  return new;
end;
$$;

drop trigger if exists truoc_khi_sua_nguoi_dung on public.nguoi_dung;
create trigger truoc_khi_sua_nguoi_dung
  before update on public.nguoi_dung
  for each row execute function public.chan_tu_sua_goi_vip();

create table if not exists giao_dich (
  id uuid primary key default gen_random_uuid(),
  nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
  ma_giao_dich text not null unique,
  goi_loai text not null,
  so_tien integer not null,
  trang_thai text not null default 'cho_thanh_toan',
  tao_luc timestamptz not null default now(),
  thanh_toan_luc timestamptz
);

alter table giao_dich enable row level security;

drop policy if exists "user xem giao dich cua minh" on giao_dich;
create policy "user xem giao dich cua minh" on giao_dich
  for select using (auth.uid() = nguoi_dung_id);

drop policy if exists "user tao giao dich cho minh" on giao_dich;
create policy "user tao giao dich cho minh" on giao_dich
  for insert with check (auth.uid() = nguoi_dung_id and trang_thai = 'cho_thanh_toan');

-- Vá bảo mật (2026-09-15, bản 1 - ĐÃ THAY THẾ bằng bản dưới): policy chặn theo HÀNG (row) khiến
-- toàn bộ metadata (tiêu đề...) của chương VIP cũng bị ẩn theo, làm vỡ danh sách chương công khai +
-- trang chương VIP trả 404 thay vì đúng ra phải mời đăng nhập/mua gói. Giữ policy đọc công khai theo
-- HÀNG như cũ, chuyển sang chặn theo CỘT (chỉ chặn noi_dung) ở bản vá bên dưới.
drop policy if exists "chuong doc theo quyen vip" on chuong;
drop policy if exists "chuong doc cong khai" on chuong;
create policy "chuong doc cong khai" on chuong for select using (true);

-- Vá bảo mật (2026-09-15, bản 2 - đúng): chính sách RLS của Postgres chỉ chặn được theo HÀNG, không
-- chặn riêng theo CỘT, nên không thể vừa cho đọc công khai tiêu đề/metadata mọi chương (cần cho danh
-- sách chương + icon khoá) vừa chặn riêng nội dung (noi_dung) chương VIP bằng 1 policy duy nhất.
-- Giải pháp: giữ nguyên hàng công khai (policy trên), nhưng THU HỒI quyền đọc trực tiếp cột noi_dung
-- của anon/authenticated, bắt buộc phải đọc nội dung qua hàm lay_noi_dung_chuong() bên dưới - hàm
-- này tự kiểm tra chương <= 50 hoặc có gói VIP hiệu lực mới trả về nội dung thật, ngược lại trả về
-- null. Áp dụng cho: app/truyen/[slug]/chuong/[so]/page.tsx (đã sửa để gọi RPC thay vì select thẳng
-- cột noi_dung). Số 50 khớp SO_CHUONG_FREE trong lib/config/goi-vip.ts.
-- LƯU Ý: phải revoke SELECT toàn bảng trước rồi mới grant lại đúng các cột an toàn - chỉ revoke
-- riêng 1 cột (bản đầu tiên mình viết, ĐÃ SAI) không có tác dụng vì quyền SELECT toàn bảng cấp sẵn
-- mặc định cho anon/authenticated vẫn bao trùm mọi cột, không bị 1 revoke cột đơn lẻ ghi đè.
revoke select on chuong from anon, authenticated;
grant select (id, truyen_id, so_chuong, tieu_de, created_at, luot_xem) on chuong to anon, authenticated;

create or replace function public.lay_noi_dung_chuong(p_chuong_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so_chuong int;
  v_noi_dung text;
  v_co_vip boolean;
begin
  select so_chuong, noi_dung into v_so_chuong, v_noi_dung
  from chuong
  where id = p_chuong_id;

  if v_so_chuong is null then
    return null;
  end if;

  if v_so_chuong <= 50 then
    return v_noi_dung;
  end if;

  select exists(
    select 1 from nguoi_dung
    where id = auth.uid()
      and goi_het_han is not null
      and goi_het_han > now()
  ) into v_co_vip;

  if v_co_vip then
    return v_noi_dung;
  end if;

  return null;
end;
$$;

grant execute on function public.lay_noi_dung_chuong(uuid) to anon, authenticated;

-- Vá bảo mật (2026-09-15, bản 3 - sửa tác dụng phụ của bản 2): sau khi thu hồi SELECT toàn bảng
-- chuong, tính năng đếm số chương lồng ghép của PostgREST (`chuong(count)`, dùng ở trang chủ +
-- trang thể loại để hiện "X chương" trên thẻ truyện) bị từ chối hoàn toàn ("permission denied for
-- table chuong") dù các cột cần thiết (truyen_id) đã được cấp quyền - PostgREST/Postgres đòi hỏi
-- quyền SELECT ở cấp bảng cho kiểu đếm gộp này, không chấp nhận quyền cấp theo cột. Hậu quả: toàn
-- bộ trang chủ mất trắng, hiện "Không tìm thấy truyện nào." dù dữ liệu vẫn còn nguyên trong DB.
-- Giải pháp: tạo 1 view riêng chỉ chứa số đếm (không đụng noi_dung), cấp quyền công khai cho view
-- này - trang chủ/trang thể loại chuyển sang đọc số chương từ view thay vì embed trực tiếp bảng
-- chuong. Áp dụng cho: app/page.tsx, app/the-loai/[slug]/page.tsx.
create or replace view public.truyen_so_chuong as
select truyen_id, count(*)::int as so_chuong
from chuong
group by truyen_id;

grant select on public.truyen_so_chuong to anon, authenticated;

-- Audio file thật (edge-tts) cho từng chương (2026-09-16) - bổ sung cho nút "Nghe" Web Speech API
-- cũ, không thay thế. audio_url null nghĩa là chương đó CHƯA có file audio (batch tạo dần theo
-- truyện). Bảng chuong đang áp dụng bảo mật cấp-cột (xem "Vá bảo mật" phía trên) nên cột mới PHẢI
-- được grant tường minh, không tự động kế thừa từ lần grant trước.
alter table chuong add column if not exists audio_url text;
grant select (audio_url) on chuong to anon, authenticated;

-- Hàng đợi tạo audio "trước 1 chương" (2026-09-16): thay vì tạo hàng loạt trước (tốn storage cho
-- cả chương chưa ai nghe) hoặc tạo tức thời theo yêu cầu (85-127s/chương, quá chậm để chờ trực
-- tiếp), khi người đọc bắt đầu bấm nghe 1 chương thì xếp hàng tạo trước chương KẾ TIẾP - worker
-- chạy trên máy ngoài (không qua hàm server Vercel, tránh giới hạn thời gian chạy) quét bảng này
-- định kỳ. Không cho anon/authenticated đọc/ghi trực tiếp, chỉ qua RPC xep_hang_tao_audio (khi xếp
-- hàng) và service role key (worker xử lý, xoá dòng khi xong).
create table if not exists hang_doi_audio (
  chuong_id uuid primary key references chuong(id) on delete cascade,
  truyen_id uuid not null references truyen(id) on delete cascade,
  so_chuong int not null,
  yeu_cau_luc timestamptz not null default now(),
  so_lan_loi int not null default 0
);

alter table hang_doi_audio enable row level security;

create or replace function public.xep_hang_tao_audio(p_chuong_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_truyen_id uuid;
  v_so_chuong int;
  v_audio_url text;
begin
  select truyen_id, so_chuong, audio_url into v_truyen_id, v_so_chuong, v_audio_url
  from chuong
  where id = p_chuong_id;

  if v_truyen_id is null or v_audio_url is not null then
    return; -- chương không tồn tại hoặc đã có audio rồi, không cần xếp hàng
  end if;

  -- Dat lai so_lan_loi = 0 khi da co dong (do nothing se khien chuong tung loi 3 lan bi worker
  -- dinh ky bo qua vinh vien - vd nguoi dung chu dong bam "Bat dau" muon thu lai) - moi lan xep
  -- hang la 1 co hoi thu lai moi.
  insert into hang_doi_audio (chuong_id, truyen_id, so_chuong)
  values (p_chuong_id, v_truyen_id, v_so_chuong)
  on conflict (chuong_id) do update set so_lan_loi = 0;
end;
$$;

grant execute on function public.xep_hang_tao_audio(uuid) to anon, authenticated;
