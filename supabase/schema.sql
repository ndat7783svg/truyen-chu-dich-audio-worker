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
