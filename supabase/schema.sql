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
