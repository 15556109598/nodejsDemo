// 情侣空间 v2 接口：档案（头像/状态）、打卡、清单、心愿、每日一句随机/指定
// 所有接口都要求已解锁（复用 couple.ts 的 requireUnlocked：Cookie → 本地凭证 → 设备链接）
import express, { NextFunction, Request, Response, Router } from 'express';
import { fail, ok } from '../utils/resp';
import {
  BUILTIN_QUOTES,
  addDays,
  computeCheckinSummary,
  isCheckinMood,
  pickRandomQuote,
  resolveDailyQuote,
  todayInShanghai,
  type QuoteOverride,
} from '../store/couple-logic';
import {
  MAX_WISH_REPLY,
  addCheckin,
  addWishReply,
  createTodo,
  createWish,
  listCheckinDay,
  listCheckinsSince,
  listProfiles,
  listTodos,
  listWishes,
  removeAvatarObject,
  removeCheckin,
  removeTodo,
  removeWish,
  respondWish,
  saveAvatarObject,
  setProfileAvatar,
  setTodoDone,
  toggleCheckinLike,
  updateProfile,
} from '../store/couple-extra';
import {
  clearQuoteOverride,
  getQuoteOverride,
  listQuotes,
  saveQuoteOverride,
} from '../store/couple';
import { requireUnlocked } from './couple';

const router = Router();

router.use(requireUnlocked);

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err: unknown) => void): void => {
    handler(req, res).catch(next);
  };
}

function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

// 允许换行的长文本：按字符截断，避免把 emoji 截成半个代理对
function longText(value: unknown, max: number): string {
  return Array.from(String(value ?? '').trim()).slice(0, max).join('');
}

function isDay(value: unknown): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

function slotOf(value: unknown): 1 | 2 | null {
  const slot = Number(value);
  return slot === 1 || slot === 2 ? slot : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function checkinSummary() {
  const today = todayInShanghai();
  const rows = await listCheckinsSince(addDays(today, -27));
  return computeCheckinSummary(rows, today, 28);
}

// ---------- 档案 ----------

router.get(
  '/profiles',
  wrap(async (_req, res) => {
    ok(res, { profiles: await listProfiles() });
  })
);

router.put(
  '/profiles/:slot',
  wrap(async (req, res) => {
    const slot = slotOf(req.params.slot);
    if (!slot) {
      fail(res, 400, '位置参数必须为 1 或 2');
      return;
    }
    const body = req.body || {};
    if (body.displayName !== undefined && !text(body.displayName, 20)) {
      fail(res, 400, '名字不能为空');
      return;
    }
    if (body.statusText !== undefined && Array.from(String(body.statusText).trim()).length > 20) {
      fail(res, 400, '状态最多 20 个字');
      return;
    }
    const profile = await updateProfile(slot, {
      displayName: body.displayName !== undefined ? text(body.displayName, 20) : undefined,
      statusText: body.statusText !== undefined ? text(body.statusText, 20) : undefined,
      statusPreset: body.statusPreset !== undefined ? text(body.statusPreset, 10) : undefined,
    });
    if (!profile) {
      fail(res, 404, '档案位置不存在');
      return;
    }
    ok(res, { profile });
  })
);

router.post(
  '/profiles/:slot/avatar',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }),
  wrap(async (req, res) => {
    const slot = slotOf(req.params.slot);
    if (!slot) {
      fail(res, 400, '位置参数必须为 1 或 2');
      return;
    }
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer) {
      fail(res, 415, '请上传 JPG / PNG / WEBP 图片');
      return;
    }
    const saved = await saveAvatarObject(slot, buffer, String(req.headers['content-type'] || ''));
    if (saved.error || !saved.url) {
      fail(res, saved.status || 400, saved.error || '头像上传失败');
      return;
    }
    const result = await setProfileAvatar(slot, saved.url);
    // 替换成功后再删旧图，避免更新失败时把仍在用的图删掉
    if (result.previous && result.previous !== saved.url) {
      await removeAvatarObject(result.previous);
    }
    ok(res, { profile: result.profile });
  })
);

router.delete(
  '/profiles/:slot/avatar',
  wrap(async (req, res) => {
    const slot = slotOf(req.params.slot);
    if (!slot) {
      fail(res, 400, '位置参数必须为 1 或 2');
      return;
    }
    const result = await setProfileAvatar(slot, '');
    if (result.previous) await removeAvatarObject(result.previous);
    ok(res, { profile: result.profile });
  })
);

// ---------- 打卡 ----------

router.get(
  '/checkins',
  wrap(async (_req, res) => {
    ok(res, await checkinSummary());
  })
);

router.post(
  '/checkins',
  wrap(async (req, res) => {
    const slot = slotOf(req.body?.slot);
    if (!slot) {
      fail(res, 400, 'slot 必须为 1 或 2');
      return;
    }
    const body = req.body || {};
    // 心情可空（不选也能打卡）；传了就必须是预设键
    if (body.mood !== undefined && body.mood !== '' && !isCheckinMood(body.mood)) {
      fail(res, 400, '心情参数不合法');
      return;
    }
    const mood = isCheckinMood(body.mood) ? body.mood : '';
    const moodText = longText(body.moodText, 12);
    const note = longText(body.note, 120);
    const today = todayInShanghai();
    await addCheckin(today, slot, { mood, moodText, note });
    ok(res, await checkinSummary());
  })
);

// 某一天的双方详情：只有一方打卡时，另一方返回 done=false 的空记录
router.get(
  '/checkins/day/:day',
  wrap(async (req, res) => {
    const day = String(req.params.day);
    if (!isDay(day)) {
      fail(res, 400, '日期格式应为 YYYY-MM-DD');
      return;
    }
    if (day > todayInShanghai()) {
      fail(res, 400, '还不能查看未来的打卡');
      return;
    }
    const rows = await listCheckinDay(day);
    const entries = ([1, 2] as const).map((slot) => {
      const row = rows.find((item) => item.slot === slot);
      return {
        slot,
        done: Boolean(row),
        time: row?.createdAt || null,
        mood: row?.mood || '',
        moodText: row?.moodText || '',
        note: row?.note || '',
        likes: row?.likes || [],
      };
    });
    ok(res, { day, entries, count: entries.filter((item) => item.done).length });
  })
);

// 点赞 / 取消赞：同一位置同一天只记一次
router.post(
  '/checkins/:day/:slot/like',
  wrap(async (req, res) => {
    const day = String(req.params.day);
    const target = slotOf(req.params.slot);
    const from = slotOf(req.body?.fromSlot);
    if (!isDay(day) || !target || !from) {
      fail(res, 400, '参数不合法');
      return;
    }
    if (day > todayInShanghai()) {
      fail(res, 400, '还不能给未来的打卡点赞');
      return;
    }
    const row = await toggleCheckinLike(day, target, from);
    if (!row) {
      fail(res, 404, '这条打卡不存在');
      return;
    }
    ok(res, { day, entry: { ...row, done: true } });
  })
);

router.delete(
  '/checkins/today/:slot',
  wrap(async (req, res) => {
    const slot = slotOf(req.params.slot);
    if (!slot) {
      fail(res, 400, '位置参数必须为 1 或 2');
      return;
    }
    await removeCheckin(todayInShanghai(), slot);
    ok(res, await checkinSummary());
  })
);

// ---------- 一起做的事 ----------

router.get(
  '/todos',
  wrap(async (_req, res) => {
    ok(res, { todos: await listTodos() });
  })
);

router.post(
  '/todos',
  wrap(async (req, res) => {
    const title = text(req.body?.title, 60);
    if (!title) {
      fail(res, 400, '请填写要做的事');
      return;
    }
    const todo = await createTodo(title);
    res.status(201).json({ code: 0, data: { todo } });
  })
);

router.put(
  '/todos/:id',
  wrap(async (req, res) => {
    if (!isUuid(String(req.params.id))) {
      fail(res, 400, '参数不合法');
      return;
    }
    if (typeof req.body?.done !== 'boolean') {
      fail(res, 400, 'done 必须为布尔值');
      return;
    }
    const todo = await setTodoDone(String(req.params.id), req.body.done);
    if (!todo) {
      fail(res, 404, '这条清单不存在');
      return;
    }
    ok(res, { todo });
  })
);

router.delete(
  '/todos/:id',
  wrap(async (req, res) => {
    if (!isUuid(String(req.params.id))) {
      fail(res, 400, '参数不合法');
      return;
    }
    const removed = await removeTodo(String(req.params.id));
    if (!removed) {
      fail(res, 404, '这条清单不存在');
      return;
    }
    ok(res, { removed: true });
  })
);

// ---------- 小约定 / 心愿 ----------

router.get(
  '/wishes',
  wrap(async (_req, res) => {
    ok(res, { wishes: await listWishes() });
  })
);

router.post(
  '/wishes',
  wrap(async (req, res) => {
    const content = text(req.body?.content, 80);
    const fromSlot = slotOf(req.body?.fromSlot);
    if (!content) {
      fail(res, 400, '请写下这个约定');
      return;
    }
    if (!fromSlot) {
      fail(res, 400, 'fromSlot 必须为 1 或 2');
      return;
    }
    const wish = await createWish(content, fromSlot);
    res.status(201).json({ code: 0, data: { wish } });
  })
);

router.post(
  '/wishes/:id/respond',
  wrap(async (req, res) => {
    if (!isUuid(String(req.params.id))) {
      fail(res, 400, '参数不合法');
      return;
    }
    const status = req.body?.status === 'accepted' || req.body?.status === 'declined' ? req.body.status : '';
    if (!status) {
      fail(res, 400, '回应只能是 accepted 或 declined');
      return;
    }
    const wish = await respondWish(String(req.params.id), status);
    if (!wish) {
      fail(res, 409, '这个约定已经回应过了，刷新看看');
      return;
    }
    ok(res, { wish });
  })
);

// 具体文字回复：多行，双方都能写；已回应/未回应都允许
router.post(
  '/wishes/:id/replies',
  wrap(async (req, res) => {
    if (!isUuid(String(req.params.id))) {
      fail(res, 400, '参数不合法');
      return;
    }
    const slot = slotOf(req.body?.slot);
    const content = longText(req.body?.content, MAX_WISH_REPLY);
    if (!slot) {
      fail(res, 400, 'slot 必须为 1 或 2');
      return;
    }
    if (!content) {
      fail(res, 400, '写点什么再回复吧');
      return;
    }
    const wish = await addWishReply(String(req.params.id), slot, content);
    if (!wish) {
      fail(res, 404, '这个约定不存在');
      return;
    }
    res.status(201).json({ code: 0, data: { wish } });
  })
);

router.delete(
  '/wishes/:id',
  wrap(async (req, res) => {
    if (!isUuid(String(req.params.id))) {
      fail(res, 400, '参数不合法');
      return;
    }
    const removed = await removeWish(String(req.params.id));
    if (!removed) {
      fail(res, 404, '这个约定不存在');
      return;
    }
    ok(res, { removed: true });
  })
);

// ---------- 每日一句 ----------

async function quoteState(override: QuoteOverride | null) {
  const today = todayInShanghai();
  const quotes = await listQuotes();
  const custom = quotes.map((q) => q.content);
  return resolveDailyQuote(today, custom, override);
}

router.get(
  '/quote/pool',
  wrap(async (_req, res) => {
    const today = todayInShanghai();
    const quotes = await listQuotes();
    const override = await getQuoteOverride(today);
    ok(res, {
      builtin: BUILTIN_QUOTES,
      custom: quotes,
      today,
      quote: resolveDailyQuote(today, quotes.map((q) => q.content), override),
    });
  })
);

router.get(
  '/quote/random',
  wrap(async (req, res) => {
    const raw = req.query.exclude;
    const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('|') : [];
    const quotes = await listQuotes();
    const pool = [...BUILTIN_QUOTES, ...quotes.map((q) => q.content)];
    const content = pickRandomQuote(pool, list.map((s) => String(s)));
    if (!content) {
      fail(res, 409, '句库里的句子都换过一轮了，明天再来或添加新句子');
      return;
    }
    const isCustom = quotes.some((q) => q.content.trim() === content);
    ok(res, { content, isCustom });
  })
);

router.put(
  '/quote/today',
  wrap(async (req, res) => {
    const content = text(req.body?.content, 120);
    if (!content) {
      fail(res, 400, '句子不能为空');
      return;
    }
    const today = todayInShanghai();
    const quotes = await listQuotes();
    const inBuiltin = BUILTIN_QUOTES.includes(content);
    const inCustom = quotes.some((q) => q.content.trim() === content);
    if (!inBuiltin && !inCustom) {
      fail(res, 400, '只能从句库里选一句');
      return;
    }
    const override = await saveQuoteOverride(today, content, inCustom ? 'custom' : 'builtin');
    ok(res, { quote: await quoteState(override) });
  })
);

router.delete(
  '/quote/today',
  wrap(async (_req, res) => {
    await clearQuoteOverride();
    ok(res, { quote: await quoteState(null) });
  })
);

// raw 请求体超限时给出可读提示（默认错误处理会变成 500）
router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large') {
    fail(res, 413, '头像不能超过 2MB');
    return;
  }
  next(err);
});

export default router;
