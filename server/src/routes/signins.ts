// 签到相关路由：每日签到 / 签到日历
import { Router, Request, Response } from 'express';
import { adminClient } from '../lib/supabase';
import { ok, fail } from '../utils/resp';
import { requireAuth } from '../middleware/auth';

const router = Router();

// 本地时区日期格式化 YYYY-MM-DD（toLocaleDateString('sv-SE')）
function fmtDate(d: Date): string {
  return d.toLocaleDateString('sv-SE');
}

// 每日签到
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const today = fmtDate(new Date());

  // 该日已签则拒绝
  const { data: exists } = await adminClient
    .from('sign_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('sign_date', today)
    .maybeSingle();
  if (exists) {
    fail(res, 400, '今天已签到');
    return;
  }

  // 取最近一条签到记录计算连续天数：最近一条是昨天则 +1，否则重置 1
  const { data: last } = await adminClient
    .from('sign_ins')
    .select('*')
    .eq('user_id', userId)
    .order('sign_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const yesterday = fmtDate(new Date(Date.now() - 86400000));
  const streak = last && last.sign_date === yesterday ? Number(last.streak) + 1 : 1;

  // 连续签到每满 7 天额外奖励 20 积分
  const bonus = streak % 7 === 0 ? 20 : 0;
  const gained = 10 + bonus;

  // 写入签到记录
  const { error: insertError } = await adminClient.from('sign_ins').insert({
    user_id: userId,
    sign_date: today,
    points: gained,
    streak,
  });
  if (insertError) {
    fail(res, 500, insertError.message);
    return;
  }

  // 更新用户积分并记录流水
  const { data: profile } = await adminClient.from('profiles').select('points').eq('id', userId).maybeSingle();
  const newPoints = (Number(profile?.points) || 0) + gained;
  await adminClient.from('profiles').update({ points: newPoints }).eq('id', userId);
  await adminClient.from('points_logs').insert({
    user_id: userId,
    change: gained,
    reason: bonus > 0 ? `每日签到·连续${streak}天额外奖励` : '每日签到',
  });

  ok(res, { pointsGained: gained, bonusGained: bonus, streak, points: newPoints });
});

// 签到日历：某年某月的签到记录、总签到数、当前连续天数、当前积分
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  // 当月区间（YYYY-MM-DD，月补零）
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  // 当月签到记录
  const { data: monthRows, error } = await adminClient
    .from('sign_ins')
    .select('sign_date, points')
    .eq('user_id', userId)
    .gte('sign_date', monthStart)
    .lte('sign_date', monthEnd)
    .order('sign_date', { ascending: true });
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  const dates = (monthRows || []).map((r: any) => ({ date: r.sign_date, points: Number(r.points) || 0 }));

  // 当月签到次数与历史总签到次数
  const monthSigned = dates.length;
  const { count: totalSigned } = await adminClient
    .from('sign_ins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // 当前连续签到天数：取 sign_date <= 今天的最近 60 条降序，从今天（没签则从昨天）开始往回数，断档即停
  const today = fmtDate(now);
  const { data: recent } = await adminClient
    .from('sign_ins')
    .select('sign_date')
    .eq('user_id', userId)
    .lte('sign_date', today)
    .order('sign_date', { ascending: false })
    .limit(60);
  const dateSet = new Set<string>((recent || []).map((r: any) => r.sign_date));
  let streak = 0;
  let cursor = new Date();
  if (!dateSet.has(fmtDate(cursor))) {
    cursor = new Date(Date.now() - 86400000);
  }
  while (streak < 60 && dateSet.has(fmtDate(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  // 当前积分
  const { data: profile } = await adminClient.from('profiles').select('points').eq('id', userId).maybeSingle();

  ok(res, {
    dates,
    monthSigned,
    totalSigned: totalSigned || 0,
    streak,
    points: Number(profile?.points) || 0,
  });
});

export default router;
