// 积分明细路由
import { Router, Request, Response } from 'express';
import { adminClient } from '../lib/supabase';
import { ok, fail } from '../utils/resp';
import { requireAuth } from '../middleware/auth';

const router = Router();

// 积分流水：按 created_at 倒序分页
router.get('/logs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));

  const { data, error } = await adminClient
    .from('points_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    fail(res, 500, error.message);
    return;
  }

  // 单独查询总数
  const { count } = await adminClient
    .from('points_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  ok(res, { list: data || [], total: count || 0 });
});

export default router;
