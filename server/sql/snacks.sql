-- ============================================
-- 零食日期管理：Supabase 迁移脚本（可重复执行）
-- 使用：Supabase Dashboard → SQL Editor → 粘贴执行
-- 说明：
--   1. 记录表 public.snacks，设置表 public.app_settings
--   2. Storage 桶 snacks（公开读），服务端用 service_role 写入
--   3. RLS：两张表开启 RLS 且不建任何 anon/authenticated 策略，
--      仅 service_role（服务端）可读写，避免匿名 key 直接改库
-- ============================================

-- ---------- 1. 零食记录表 ----------
create table if not exists public.snacks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default '',
  quantity integer not null default 1 check (quantity between 1 and 999),
  expire_date date not null,
  note text not null default '',
  photo_url text not null default '',
  finished boolean not null default false,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.snacks is '零食日期管理记录（服务端 service_role 读写）';

-- 到期日排序 / 已用完筛选
create index if not exists snacks_expire_date_idx on public.snacks (expire_date);
create index if not exists snacks_finished_expire_idx on public.snacks (finished, expire_date);

-- updated_at 自动维护
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists snacks_touch_updated_at on public.snacks;
create trigger snacks_touch_updated_at
  before update on public.snacks
  for each row execute function public.touch_updated_at();

-- ---------- 2. 全局设置表（临近过期阈值等） ----------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('snacks', '{"nearDays": 7}'::jsonb)
on conflict (key) do nothing;

-- ---------- 3. RLS：只允许 service_role ----------
alter table public.snacks enable row level security;
alter table public.app_settings enable row level security;

-- 不创建 anon / authenticated 策略：匿名与登录用户均无直接读写权限；
-- service_role key 会绕过 RLS，仅在服务端使用，切勿下发到浏览器。

-- ---------- 4. Storage 桶（公开读，服务端写） ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'snacks',
  'snacks',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 公开读策略（图片通过 /storage/v1/object/public/... 直接访问）
drop policy if exists "snacks_public_read" on storage.objects;
create policy "snacks_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'snacks');
