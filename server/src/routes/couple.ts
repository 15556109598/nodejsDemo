// 情侣空间接口
// 隐私门：COUPLE_PASSCODE 存在时，除 /session /auth /daily 外的所有接口都要求有效 cookie
// POST /api/couple/auth          口令换 httpOnly cookie（90 天）
// GET  /api/couple/session       口令是否已配置 + 当前是否解锁
// POST /api/couple/lock          清除 cookie
// GET  /api/couple/overview      今日全部数据（纪念日/每日一句/天气/经期/提醒/摘要/设置）
// GET  /api/couple/weather       单独刷新天气（失败降级，不抛 5xx）
// POST /api/couple/anniversaries       新增纪念日
// PUT  /api/couple/anniversaries/:id   编辑纪念日
// DELETE /api/couple/anniversaries/:id 删除纪念日
// POST /api/couple/cycles              新增经期记录
// PUT  /api/couple/cycles/:id          编辑经期记录
// DELETE /api/couple/cycles/:id        删除经期记录
// POST /api/couple/quotes              新增自定义句子
// DELETE /api/couple/quotes/:id        删除自定义句子
// PUT  /api/couple/settings            保存设置（城市/坐标/提醒阈值）
// POST /api/couple/daily               定时推送（x-cron-secret 保护，未配 webhook 时跳过）
import crypto from 'crypto';
import express, { Request, Response, Router } from 'express';
import { ok, fail } from '../utils/resp';
import { env } from '../env';
import {
  anniversaryView,
  buildDailySummary,
  buildReminders,
  computeCycleStats,
  isValidDay,
  pickDailyQuote,
  predictCycle,
  todayInShanghai,
  type CoupleAnniversary,
  type CoupleSettings,
} from '../store/couple-logic';
import {
  createAnniversary,
  createCycle,
  createQuote,
  getSettings,
  getWeather,
  listAnniversaries,
  listCycles,
  listQuotes,
  removeAnniversary,
  removeCycle,
  removeQuote,
  saveSettings,
  updateAnniversary,
  updateCycle,
  type AnniversaryInput,
  type CycleInput,
} from '../store/couple';

const router = Router();

const COOKIE_NAME = 'couple_access';
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 天

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err: unknown) => void): void => {
    handler(req, res).catch(next);
  };
}

// ---------- 口令 cookie ----------

// cookie 值 = HMAC(口令, 固定文案)，不含明文口令；比较使用等长常量时间比较
function expectedToken(): string | null {
  if (!env.COUPLE_PASSCODE) return null;
  return crypto.createHmac('sha256', env.COUPLE_PASSCODE).update('xiaochu-couple-v1').digest('hex');
}

function readCookie(req: Request, name: string): string {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return '';
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function isUnlocked(req: Request): boolean {
  const token = expectedToken();
  if (!token) return true; // 未配置口令：公开可见
  return safeEqual(readCookie(req, COOKIE_NAME), token);
}

function isHttps(req: Request): boolean {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function setAuthCookie(req: Request, res: Response): void {
  const token = expectedToken();
  if (!token) return;
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(req: Request, res: Response): void {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

// 简单防爆破：同一来源 5 分钟内最多 6 次失败
const failures = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function tooManyFailures(key: string): boolean {
  const item = failures.get(key);
  if (!item) return false;
  if (Date.now() > item.resetAt) {
    failures.delete(key);
    return false;
  }
  return item.count >= 6;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const item = failures.get(key);
  if (!item || now > item.resetAt) {
    failures.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return;
  }
  item.count += 1;
  // 防止 Map 无限增长
  if (failures.size > 500) {
    for (const [k, v] of failures) if (now > v.resetAt) failures.delete(k);
  }
}

function requireUnlocked(req: Request, res: Response, next: (err?: unknown) => void): void {
  if (isUnlocked(req)) {
    next();
    return;
  }
  fail(res, 401, '请输入口令后再访问');
}

// ---------- 校验 ----------

function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function validateAnniversary(body: any, partial = false): { error?: string; data?: Partial<AnniversaryInput> } {
  const data: Partial<AnniversaryInput> = {};

  if (!partial || body.title !== undefined) {
    const title = text(body.title, 40);
    if (!title) return { error: '请填写纪念日名称' };
    data.title = title;
  }
  if (!partial || body.date !== undefined) {
    const date = String(body.date ?? '').trim();
    if (!isValidDay(date)) return { error: '请选择合法的日期（YYYY-MM-DD）' };
    data.date = date;
  }
  if (!partial || body.yearly !== undefined) {
    data.yearly = Boolean(body.yearly);
  }
  if (!partial || body.icon !== undefined) {
    const icon = text(body.icon, 8);
    if (Array.from(icon).length > 4) return { error: '图标最多 4 个字符' };
    data.icon = icon;
  }
  if (!partial || body.photoUrl !== undefined) {
    const photoUrl = text(body.photoUrl, 500);
    if (photoUrl && !/^https:\/\/\S+$/.test(photoUrl)) return { error: '照片地址需为 https 链接' };
    data.photoUrl = photoUrl;
  }
  if (!partial || body.pinned !== undefined) {
    data.pinned = Boolean(body.pinned);
  }
  return { data };
}

function validateCycle(body: any, partial = false): { error?: string; data?: Partial<CycleInput> } {
  const data: Partial<CycleInput> = {};

  if (!partial || body.startDate !== undefined) {
    const startDate = String(body.startDate ?? '').trim();
    if (!isValidDay(startDate)) return { error: '请选择合法的开始日期' };
    data.startDate = startDate;
  }
  if (!partial || body.endDate !== undefined) {
    const rawEnd = body.endDate === null || body.endDate === undefined ? '' : String(body.endDate).trim();
    if (rawEnd && !isValidDay(rawEnd)) return { error: '请选择合法的结束日期' };
    data.endDate = rawEnd || null;
  }
  if (body.startDate !== undefined && body.endDate !== undefined) {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      return { error: '结束日期不能早于开始日期' };
    }
  }
  if (!partial || body.note !== undefined) {
    const note = text(body.note, 120);
    data.note = note;
  }
  return { data };
}

// 编辑经期记录时补齐未提交的字段再做区间校验
function cycleRangeError(current: { startDate: string; endDate: string | null }, patch: Partial<CycleInput>): string | null {
  const start = patch.startDate ?? current.startDate;
  const end = patch.endDate !== undefined ? patch.endDate : current.endDate;
  if (end && end < start) return '结束日期不能早于开始日期';
  return null;
}

// ---------- 数据聚合 ----------

async function composeSnapshot() {
  const today = todayInShanghai();
  const [anniversaries, records, quotes, settings] = await Promise.all([
    listAnniversaries(),
    listCycles(),
    listQuotes(),
    getSettings(),
  ]);
  const weather = await getWeather(settings);

  const withViews = anniversaries
    .map((item) => ({ ...item, ...anniversaryView(item, today) }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const keyA = a.daysUntilNext < 0 ? 9000 - a.daysUntilNext : a.daysUntilNext;
      const keyB = b.daysUntilNext < 0 ? 9000 - b.daysUntilNext : b.daysUntilNext;
      return keyA - keyB;
    });

  const stats = computeCycleStats(records);
  const prediction = predictCycle(records, stats, settings, today);
  const quote = pickDailyQuote(today, quotes.map((q) => q.content));
  const reminders = buildReminders({ today, anniversaries: withViews as CoupleAnniversary[], prediction, weather, settings });
  const summary = buildDailySummary({
    today,
    settings,
    anniversaries: withViews as CoupleAnniversary[],
    quote: quote.content,
    weather,
    prediction,
    reminders,
  });

  return {
    today,
    passcodeSet: Boolean(env.COUPLE_PASSCODE),
    settings,
    anniversaries: withViews,
    quote,
    weather,
    cycle: { records, stats, prediction },
    reminders,
    summary,
    customQuotes: quotes,
  };
}

// ---------- 路由 ----------

// 解锁：口令正确下发 cookie；未配置口令时直接视为解锁
router.post(
  '/auth',
  wrap(async (req, res) => {
    if (!env.COUPLE_PASSCODE) {
      ok(res, { unlocked: true, passcodeSet: false, message: '未设置 COUPLE_PASSCODE，当前内容公开可见' });
      return;
    }
    const key = clientKey(req);
    if (tooManyFailures(key)) {
      fail(res, 429, '尝试次数过多，请 5 分钟后再试');
      return;
    }
    const input = String(req.body?.passcode ?? '').trim();
    if (!input) {
      fail(res, 400, '请输入口令');
      return;
    }
    const token = expectedToken();
    if (!token || !safeEqual(input, env.COUPLE_PASSCODE)) {
      recordFailure(key);
      fail(res, 401, '口令不正确');
      return;
    }
    failures.delete(key);
    setAuthCookie(req, res);
    ok(res, { unlocked: true, passcodeSet: true });
  })
);

router.get('/session', (req: Request, res: Response) => {
  ok(res, { passcodeSet: Boolean(env.COUPLE_PASSCODE), unlocked: isUnlocked(req) });
});

router.post('/lock', (req: Request, res: Response) => {
  clearAuthCookie(req, res);
  ok(res, { unlocked: !env.COUPLE_PASSCODE });
});

// 定时推送：必须配置 COUPLE_CRON_SECRET，否则接口关闭；未配 webhook 时返回 sent:false，不算失败
router.post(
  '/daily',
  wrap(async (req, res) => {
    if (!env.COUPLE_CRON_SECRET) {
      fail(res, 503, '未配置 COUPLE_CRON_SECRET，定时推送未启用');
      return;
    }
    const secret = String(req.headers['x-cron-secret'] || '');
    if (!safeEqual(secret, env.COUPLE_CRON_SECRET)) {
      fail(res, 401, '定时任务密钥不正确');
      return;
    }

    const snapshot = await composeSnapshot();
    if (!env.COUPLE_FEISHU_WEBHOOK) {
      ok(res, { sent: false, reason: '未配置 COUPLE_FEISHU_WEBHOOK', summary: snapshot.summary });
      return;
    }

    const response = await fetch(env.COUPLE_FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text: snapshot.summary.text } }),
    });
    if (!response.ok) {
      fail(res, 502, `飞书推送失败：HTTP ${response.status}`);
      return;
    }
    const body: any = await response.json().catch(() => ({}));
    const feishuCode = Number(body?.code ?? body?.StatusCode ?? 0);
    if (feishuCode !== 0) {
      fail(res, 502, `飞书推送失败：${body?.msg || '未知错误'}`);
      return;
    }
    ok(res, { sent: true, summary: snapshot.summary });
  })
);

// 以下接口全部需要口令（未配置口令时自动放行）
router.use(requireUnlocked);

router.get(
  '/overview',
  wrap(async (_req, res) => {
    ok(res, await composeSnapshot());
  })
);

router.get(
  '/weather',
  wrap(async (_req, res) => {
    const settings = await getSettings();
    ok(res, await getWeather(settings));
  })
);

router.post(
  '/anniversaries',
  wrap(async (req, res) => {
    const { error, data } = validateAnniversary(req.body || {});
    if (error || !data) {
      fail(res, 400, error || '参数不合法');
      return;
    }
    ok(res, await createAnniversary(data as AnniversaryInput));
  })
);

router.put(
  '/anniversaries/:id',
  wrap(async (req, res) => {
    const { error, data } = validateAnniversary(req.body || {}, true);
    if (error || !data) {
      fail(res, 400, error || '参数不合法');
      return;
    }
    const item = await updateAnniversary(req.params.id, data);
    if (!item) {
      fail(res, 404, '纪念日不存在');
      return;
    }
    ok(res, item);
  })
);

router.delete(
  '/anniversaries/:id',
  wrap(async (req, res) => {
    const removed = await removeAnniversary(req.params.id);
    if (!removed) {
      fail(res, 404, '纪念日不存在');
      return;
    }
    ok(res, { id: req.params.id });
  })
);

router.post(
  '/cycles',
  wrap(async (req, res) => {
    const { error, data } = validateCycle(req.body || {});
    if (error || !data) {
      fail(res, 400, error || '参数不合法');
      return;
    }
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      fail(res, 400, '结束日期不能早于开始日期');
      return;
    }
    ok(res, await createCycle(data as CycleInput));
  })
);

router.put(
  '/cycles/:id',
  wrap(async (req, res) => {
    const { error, data } = validateCycle(req.body || {}, true);
    if (error || !data) {
      fail(res, 400, error || '参数不合法');
      return;
    }
    const current = (await listCycles()).find((item) => item.id === req.params.id);
    if (!current) {
      fail(res, 404, '经期记录不存在');
      return;
    }
    const rangeError = cycleRangeError(current, data);
    if (rangeError) {
      fail(res, 400, rangeError);
      return;
    }
    const item = await updateCycle(req.params.id, data);
    if (!item) {
      fail(res, 404, '经期记录不存在');
      return;
    }
    ok(res, item);
  })
);

router.delete(
  '/cycles/:id',
  wrap(async (req, res) => {
    const removed = await removeCycle(req.params.id);
    if (!removed) {
      fail(res, 404, '经期记录不存在');
      return;
    }
    ok(res, { id: req.params.id });
  })
);

router.post(
  '/quotes',
  wrap(async (req, res) => {
    const content = text(req.body?.content, 120);
    if (!content) {
      fail(res, 400, '请填写句子内容');
      return;
    }
    ok(res, await createQuote(content));
  })
);

router.delete(
  '/quotes/:id',
  wrap(async (req, res) => {
    const removed = await removeQuote(req.params.id);
    if (!removed) {
      fail(res, 404, '句子不存在');
      return;
    }
    ok(res, { id: req.params.id });
  })
);

router.put(
  '/settings',
  wrap(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      fail(res, 400, '参数不合法');
      return;
    }
    const settings: CoupleSettings = await saveSettings(body);
    ok(res, settings);
  })
);

export default router;
