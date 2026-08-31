// Supabase 客户端：index.ts 首行已导入 polyfill，保证 fetch 可用
import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

// 管理员客户端：使用 service_role key，绕过 RLS
export const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 匿名客户端：使用 anon key，仅用于登录换取 token
export const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
