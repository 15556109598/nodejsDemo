// 情侣空间 v2 接口：档案（头像/状态）、打卡、清单、心愿、每日一句随机/指定
// 所有接口都要求已解锁（复用 couple.ts 的 requireUnlocked：Cookie → 本地凭证 → 设备链接）
import express, { NextFunction, Request, Response, Router } from 'express';
import { fail, ok } from '../utils/resp';
import {
  BUILTIN_QUOTES,
  addDays,
  computeCheckinSummary,
  pickRandomQuote,
  resolveDailyQuote,
  todayInShanghai,
  type QuoteOverride,
} from '../store/couple-logic';
import {
  addCheckin,
  createTodo,
  createWish,
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
    const today = todayInShanghai();
    await addCheckin(today, slot);
    ok(res, await checkinSummary());
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
