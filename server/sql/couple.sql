-- ============================================
-- 情侣空间（/couple）：Supabase 迁移脚本（可重复执行）
-- 使用：Supabase Dashboard → SQL Editor → 粘贴执行 → Run
-- 说明：
--   1. 四张表：couple_anniversaries / couple_cycle_records / couple_quotes / couple_settings
--   2. 全部开启 RLS 且不创建任何 anon/authenticated 策略：只有服务端 service_role 可读写
--   3. 内容含私密信息，请勿把 service_role key 下发到浏览器
-- ============================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- updated_at 自动维护（与 snacks.sql 共用同一个函数，重复执行安全）
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- 1. 纪念日 ----------
create table if not exists public.couple_anniversaries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 40),
  -- 起始日期；yearly=true 时按每年的月/日重复
  date date not null,
  yearly boolean not null default false,
  -- 可选 emoji 图标（最多 4 个字符）
  icon text not null default '',
  -- 可选照片（仅允许 https 地址）
  photo_url text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.couple_anniversaries is '情侣空间：纪念日（服务端 service_role 读写）';

create index if not exists couple_anniversaries_date_idx on public.couple_anniversaries (date);
create index if not exists couple_anniversaries_pinned_idx on public.couple_anniversaries (pinned);

drop trigger if exists couple_anniversaries_touch_updated_at on public.couple_anniversaries;
create trigger couple_anniversaries_touch_updated_at
  before update on public.couple_anniversaries
  for each row execute function public.touch_updated_at();

-- ---------- 2. 经期记录 ----------
create table if not exists public.couple_cycle_records (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_cycle_records_range check (end_date is null or end_date >= start_date)
);

comment on table public.couple_cycle_records is '情侣空间：经期记录（仅用于周期估算，不构成医疗建议）';

create index if not exists couple_cycle_records_start_idx on public.couple_cycle_records (start_date desc);

drop trigger if exists couple_cycle_records_touch_updated_at on public.couple_cycle_records;
create trigger couple_cycle_records_touch_updated_at
  before update on public.couple_cycle_records
  for each row execute function public.touch_updated_at();

-- ---------- 3. 自定义每日一句 ----------
create table if not exists public.couple_quotes (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 1 and 120),
  is_custom boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.couple_quotes is '情侣空间：自定义句子（内置句子在服务端代码中按日期轮换）';

create index if not exists couple_quotes_created_idx on public.couple_quotes (created_at desc);

-- ---------- 4. 设置（单行 key='couple'） ----------
create table if not exists public.couple_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.couple_settings (key, value)
values ('couple', '{}'::jsonb)
on conflict (key) do nothing;

comment on table public.couple_settings is '情侣空间：城市/坐标/提醒阈值等设置';

-- ---------- 5. RLS：只允许 service_role ----------
alter table public.couple_anniversaries enable row level security;
alter table public.couple_cycle_records enable row level security;
alter table public.couple_quotes enable row level security;
alter table public.couple_settings enable row level security;

-- 不创建 anon / authenticated 策略；service_role key 绕过 RLS，仅服务端持有。
