// 认证相关路由：注册 / 登录 / 获取当前用户
import { Router, Request, Response } from 'express';
import { adminClient, anonClient } from '../lib/supabase';
import { ok, fail } from '../utils/resp';
import { requireAuth } from '../middleware/auth';
import { Profile } from '../types';

const router = Router();

// 查询用户 profile：触发器自动创建，查不到时等待 500ms 重试，最多 3 次
async function fetchProfileWithRetry(userId: string): Promise<Profile | null> {
  for (let i = 0; i < 3; i++) {
    const { data } = await adminClient.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) return data as Profile;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

// profile 查询失败时的默认值兜底
function fallbackProfile(userId: string, nickname?: string): Profile {
  return {
    id: userId,
    nickname: nickname || '食客',
    avatar_url: null,
    points: 0,
    created_at: new Date().toISOString(),
  };
}

// 统一构造返回给前端的 user 对象（数字字段转 Number）
function toUser(profile: Profile): Profile {
  return { ...profile, points: Number(profile.points) || 0 };
}

// 注册：创建认证用户 → 登录换 token → 查 profile
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, nickname } = req.body || {};
  if (!email || !password) {
    fail(res, 400, '邮箱和密码不能为空');
    return;
  }
  // 管理员创建用户，直接标记邮箱已确认
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname: nickname || '' },
  });
  if (createError) {
    if (createError.message && createError.message.toLowerCase().includes('already')) {
      fail(res, 400, '该邮箱已注册');
      return;
    }
    fail(res, 400, createError.message || '注册失败');
    return;
  }
  const userId = createData?.user?.id;
  if (!userId) {
    fail(res, 500, '注册失败');
    return;
  }
  // 使用 anon client 登录换取 token
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInError || !signInData?.session) {
    fail(res, 500, '注册成功但登录失败：' + (signInError?.message || '未知错误'));
    return;
  }
  // 查询 profile（触发器自动创建，带重试兜底）
  const profile = await fetchProfileWithRetry(userId);
  ok(res, {
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
    user: toUser(profile || fallbackProfile(userId, nickname)),
  });
});

// 登录
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    fail(res, 400, '邮箱和密码不能为空');
    return;
  }
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session || !data?.user) {
    fail(res, 401, '邮箱或密码错误');
    return;
  }
  const userId = data.user.id;
  const profile = await fetchProfileWithRetry(userId);
  ok(res, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: toUser(profile || fallbackProfile(userId)),
  });
});

// 获取当前登录用户信息
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { data, error } = await adminClient.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!data) {
    fail(res, 404, '用户不存在');
    return;
  }
  ok(res, toUser(data as Profile));
});

export default router;
