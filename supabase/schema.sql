-- ============================================================
-- 小厨点餐 H5 —— Supabase 数据库 Schema
-- 使用方法：在 Supabase Dashboard -> SQL Editor 中整体粘贴执行
-- ============================================================

-- ---------- 1. 用户资料表（注册后由触发器自动创建） ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '食客',
  avatar_url text,
  points int not null default 0,
  created_at timestamptz not null default now()
);

-- 新用户注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    null
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- 2. 菜品分类 ----------
create table public.categories (
  id bigserial primary key,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 3. 菜品 ----------
-- spiciness: 0 不辣 / 1 微辣 / 2 中辣 / 3 特辣
-- specs: 规格 JSON，如 [{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":6}]}]
create table public.dishes (
  id bigserial primary key,
  category_id bigint not null references public.categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_url text,
  price numeric(10,2) not null,
  rating numeric(2,1) not null default 4.8,
  monthly_sales int not null default 0,
  spiciness int not null default 0,
  specs jsonb not null default '[]'::jsonb,
  sold_out boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_dishes_category on public.dishes(category_id);

-- ---------- 4. 订单 ----------
-- status: pending_pay 待支付 / preparing 制作中 / ready 待取餐 / completed 已完成 / cancelled 已取消
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending_pay',
  total numeric(10,2) not null default 0,
  points_used int not null default 0,
  points_earned int not null default 0,
  remark text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_user on public.orders(user_id, status, created_at desc);

-- ---------- 5. 订单明细 ----------
create table public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id bigint references public.dishes(id) on delete set null,
  dish_name text not null,
  image_url text,
  spec text not null default '',
  unit_price numeric(10,2) not null,
  qty int not null default 1
);
create index idx_order_items_order on public.order_items(order_id);

-- ---------- 6. 签到记录 ----------
create table public.sign_ins (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sign_date date not null,
  points int not null default 10,
  streak int not null default 1,
  created_at timestamptz not null default now(),
  unique(user_id, sign_date)
);
create index idx_sign_ins_user on public.sign_ins(user_id, sign_date);

-- ---------- 7. 订单评价 ----------
create table public.reviews (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  content text not null default '',
  created_at timestamptz not null default now(),
  unique(order_id)
);

-- ---------- 8. 积分明细 ----------
create table public.points_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  change int not null,               -- 正数=收入 负数=支出
  reason text not null,
  created_at timestamptz not null default now()
);
create index idx_points_logs_user on public.points_logs(user_id, created_at desc);

-- ---------- RLS ----------
-- 后端使用 service_role 密钥访问，可绕过 RLS；
-- 这里对全部业务表启用 RLS 且不建匿名策略，防止 anon key 直接读写数据。
alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.dishes      enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.sign_ins    enable row level security;
alter table public.reviews     enable row level security;
alter table public.points_logs enable row level security;
