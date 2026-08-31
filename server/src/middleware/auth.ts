// 认证中间件：校验 Bearer token，成功后挂载 userId
import { Request, Response, NextFunction } from 'express';
import { adminClient } from '../lib/supabase';
import { fail } from '../utils/resp';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    fail(res, 401, '请先登录');
    return;
  }
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user) {
    fail(res, 401, '请先登录');
    return;
  }
  (req as any).userId = data.user.id;
  next();
}
