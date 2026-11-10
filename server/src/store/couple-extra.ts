// 情侣空间 v2 数据访问：档案（头像/状态）/ 打卡 / 清单 / 心愿
// 复用已有的 couple_settings（key/value jsonb）存储，避免新增表；
// 头像放在 Storage 桶 couple-avatars，首次上传时惰性创建（public）。
// 仅服务端使用 service_role。
import crypto, { randomUUID } from 'crypto';
import { adminClient } from '../lib/supabase';

const SETTINGS_TABLE = 'couple_settings';
const AVATAR_BUCKET = 'couple-avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const CHECKIN_KEEP_DAYS = 400;

const PROFILE_KEY = 'couple_profiles';
const CHECKIN_KEY = 'couple_checkins';
const TODO_KEY = 'couple_todos';
const WISH_KEY = 'couple_wishes';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function raise(error: any): never {
  const err = new Error(error?.message || '数据库操作失败') as Error & { code?: string; sqlFile?: string };
  err.code = error?.code;
  err.sqlFile = 'server/sql/couple.sql';
  throw err;
}

// ---------- settings JSON key 读写 ----------
// couple_settings 是 key/value 结构；同一 key 的读改写串行执行，避免并发覆盖丢数据。

const keyQueue = new Map<string, Promise<unknown>>();

function withKeyLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = keyQueue.get(key) || Promise.resolve();
  const next = previous.then(task, task);
  keyQueue.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}

async function readValue(key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await adminClient
    .from(SETTINGS_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) raise(error);
  const value = data?.value;
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

async function writeValue(key: string, value: Record<string, unknown>): Promise<void> {
  const { error } = await adminClient
    .from(SETTINGS_TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) raise(error);
}

// ---------- 档案 ----------

export interface CoupleProfile {
  slot: 1 | 2;
  displayName: string;
  avatarUrl: string;
  statusText: string;
  statusPreset: string;
  statusUpdatedAt: string | null;
}

function defaultProfiles(): CoupleProfile[] {
  return [
    {
      slot: 1,
      displayName: '我',
      avatarUrl: '',
      statusText: '',
      statusPreset: '',
      statusUpdatedAt: null,
    },
    {
      slot: 2,
      displayName: 'TA',
      avatarUrl: '',
      statusText: '',
      statusPreset: '',
      statusUpdatedAt: null,
    },
  ];
}

function normalizeProfile(raw: any, slot: 1 | 2, fallbackName: string): CoupleProfile {
  return {
    slot,
    displayName: typeof raw?.displayName === 'string' && raw.displayName.trim() ? raw.displayName.slice(0, 20) : fallbackName,
    avatarUrl: typeof raw?.avatarUrl === 'string' ? raw.avatarUrl : '',
    statusText: typeof raw?.statusText === 'string' ? raw.statusText.slice(0, 20) : '',
    statusPreset: typeof raw?.statusPreset === 'string' ? raw.statusPreset.slice(0, 10) : '',
    statusUpdatedAt: typeof raw?.statusUpdatedAt === 'string' && raw.statusUpdatedAt ? raw.statusUpdatedAt : null,
  };
}

function normalizeProfiles(raw: Record<string, unknown> | null): CoupleProfile[] {
  const list = Array.isArray((raw as any)?.profiles) ? (raw as any).profiles : [];
  const base = defaultProfiles();
  return base.map((item) => {
    const found = list.find((p: any) => Number(p?.slot) === item.slot);
    return normalizeProfile(found, item.slot, item.displayName);
  });
}

export async function listProfiles(): Promise<CoupleProfile[]> {
  return normalizeProfiles(await readValue(PROFILE_KEY));
}

async function persistProfiles(profiles: CoupleProfile[]): Promise<void> {
  await writeValue(PROFILE_KEY, { profiles });
}

export interface ProfilePatch {
  displayName?: string;
  statusText?: string;
  statusPreset?: string;
}

export function updateProfile(slot: 1 | 2, patch: ProfilePatch): Promise<CoupleProfile | null> {
  return withKeyLock(PROFILE_KEY, async () => {
    const profiles = normalizeProfiles(await readValue(PROFILE_KEY));
    const target = profiles.find((item) => item.slot === slot);
    if (!target) return null;
    if (patch.displayName !== undefined) target.displayName = patch.displayName || target.displayName;
    if (patch.statusText !== undefined || patch.statusPreset !== undefined) {
      target.statusText = patch.statusText ?? '';
      target.statusPreset = patch.statusPreset ?? '';
      target.statusUpdatedAt = new Date().toISOString();
    }
    await persistProfiles(profiles);
    return target;
  });
}

export function setProfileAvatar(
  slot: 1 | 2,
  avatarUrl: string
): Promise<{ profile: CoupleProfile; previous: string }> {
  return withKeyLock(PROFILE_KEY, async () => {
    const profiles = normalizeProfiles(await readValue(PROFILE_KEY));
    const target = profiles.find((item) => item.slot === slot);
    if (!target) throw new Error('档案位置不存在');
    const previous = target.avatarUrl;
    target.avatarUrl = avatarUrl;
    await persistProfiles(profiles);
    return { profile: target, previous };
  });
}

// 校验图片真实类型（魔数），防止伪装扩展名
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// 桶惰性创建：不需要用户提前在 Supabase 建桶
async function ensureAvatarBucket(): Promise<string | null> {
  const { data, error } = await adminClient.storage.getBucket(AVATAR_BUCKET);
  if (!error && data) return null;
  const created = await adminClient.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_AVATAR_BYTES,
  });
  return created.error ? created.error.message : null;
}

export interface SaveAvatarResult {
  url?: string;
  error?: string;
  status?: number;
}

export async function saveAvatarObject(
  slot: 1 | 2,
  buffer: Buffer,
  declaredMime: string
): Promise<SaveAvatarResult> {
  const mime = String(declaredMime || '').split(';')[0].trim().toLowerCase();
  if (!MIME_EXT[mime]) return { error: '头像仅支持 JPG / PNG / WEBP 格式', status: 415 };
  if (!buffer || buffer.length === 0) return { error: '图片内容为空', status: 400 };
  if (buffer.length > MAX_AVATAR_BYTES) return { error: '头像不能超过 2MB', status: 413 };
  const ext = sniffImageExt(buffer);
  if (!ext) return { error: '图片内容不合法（文件头校验失败）', status: 400 };

  const bucketError = await ensureAvatarBucket();
  if (bucketError) return { error: `头像存储不可用：${bucketError}`, status: 502 };

  const path = `slot-${slot}/${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const { error } = await adminClient.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: EXT_MIME[ext],
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) return { error: `头像上传失败：${error.message}`, status: 502 };
  const { data } = adminClient.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// 替换/删除头像后清理旧对象；失败只记日志，不影响主流程
export async function removeAvatarObject(url: string): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path) return;
  const { error } = await adminClient.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.warn('[couple] 清理旧头像失败:', error.message);
}

// ---------- 打卡 ----------

export interface CheckinRowView {
  day: string;
  slot: number;
  createdAt: string | null;
  mood: string;
  moodText: string;
  note: string;
  likes: number[];
}

function normalizeLikes(raw: any): number[] {
  const list: any[] = Array.isArray(raw) ? raw : [];
  const out: number[] = [];
  for (const item of list) {
    const n = Number(item);
    if ((n === 1 || n === 2) && !out.includes(n)) out.push(n);
  }
  return out.sort();
}

function normalizeCheckinRows(raw: Record<string, unknown> | null): CheckinRowView[] {
  const list = Array.isArray((raw as any)?.rows) ? (raw as any).rows : [];
  return list
    .filter((row: any) => row && typeof row.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.day))
    .map((row: any) => ({
      day: row.day,
      slot: Number(row.slot) === 2 ? 2 : 1,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
      mood: typeof row.mood === 'string' ? row.mood.slice(0, 12) : '',
      moodText: typeof row.moodText === 'string' ? row.moodText.slice(0, 12) : '',
      note: typeof row.note === 'string' ? row.note.slice(0, 120) : '',
      likes: normalizeLikes(row.likes),
    }));
}

export async function listCheckinsSince(sinceDay: string): Promise<CheckinRowView[]> {
  const rows = normalizeCheckinRows(await readValue(CHECKIN_KEY));
  return rows.filter((row) => row.day >= sinceDay).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

export async function listCheckinDay(day: string): Promise<CheckinRowView[]> {
  const rows = normalizeCheckinRows(await readValue(CHECKIN_KEY));
  return rows.filter((row) => row.day === day).sort((a, b) => a.slot - b.slot);
}

export interface CheckinDetail {
  mood?: string;
  moodText?: string;
  note?: string;
}

// 幂等：同一天同一个人重复打卡不会新增第二条；再次提交只更新心情/描述
export function addCheckin(day: string, slot: 1 | 2, detail: CheckinDetail = {}): Promise<boolean> {
  return withKeyLock(CHECKIN_KEY, async () => {
    const rows = normalizeCheckinRows(await readValue(CHECKIN_KEY));
    const existing = rows.find((row) => row.day === day && row.slot === slot);
    if (existing) {
      existing.mood = detail.mood ?? existing.mood;
      existing.moodText = detail.moodText ?? existing.moodText;
      existing.note = detail.note ?? existing.note;
      await writeValue(CHECKIN_KEY, { rows });
      return false;
    }
    rows.push({
      day,
      slot,
      createdAt: new Date().toISOString(),
      mood: detail.mood || '',
      moodText: detail.moodText || '',
      note: detail.note || '',
      likes: [],
    });
    // 只保留最近 CHECKIN_KEEP_DAYS 天，避免 settings 里的 JSON 无限增长
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CHECKIN_KEEP_DAYS);
    const minDay = cutoff.toISOString().slice(0, 10);
    const kept = rows.filter((row) => row.day >= minDay).sort((a, b) => (a.day < b.day ? -1 : 1));
    await writeValue(CHECKIN_KEY, { rows: kept });
    return true;
  });
}

export function removeCheckin(day: string, slot: 1 | 2): Promise<boolean> {
  return withKeyLock(CHECKIN_KEY, async () => {
    const rows = normalizeCheckinRows(await readValue(CHECKIN_KEY));
    const next = rows.filter((row) => !(row.day === day && row.slot === slot));
    if (next.length === rows.length) return false;
    await writeValue(CHECKIN_KEY, { rows: next });
    return true;
  });
}

// 给某天某人的打卡点赞/取消赞：同一位置只记一次，可重复点击切换
export function toggleCheckinLike(
  day: string,
  targetSlot: 1 | 2,
  fromSlot: 1 | 2
): Promise<CheckinRowView | null> {
  return withKeyLock(CHECKIN_KEY, async () => {
    const rows = normalizeCheckinRows(await readValue(CHECKIN_KEY));
    const target = rows.find((row) => row.day === day && row.slot === targetSlot);
    if (!target) return null;
    target.likes = target.likes.includes(fromSlot)
      ? target.likes.filter((n) => n !== fromSlot)
      : [...target.likes, fromSlot].sort();
    await writeValue(CHECKIN_KEY, { rows });
    return target;
  });
}

// ---------- 一起做的事 ----------

export interface CoupleTodo {
  id: string;
  title: string;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
}

function normalizeTodos(raw: Record<string, unknown> | null): CoupleTodo[] {
  const list: any[] = Array.isArray((raw as any)?.todos) ? (raw as any).todos : [];
  const todos: CoupleTodo[] = list
    .filter((row: any) => row && typeof row.id === 'string')
    .map((row: any) => ({
      id: row.id,
      title: typeof row.title === 'string' ? row.title.slice(0, 60) : '',
      done: Boolean(row.done),
      doneAt: typeof row.doneAt === 'string' && row.doneAt ? row.doneAt : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    }));
  return todos.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function listTodos(): Promise<CoupleTodo[]> {
  return normalizeTodos(await readValue(TODO_KEY));
}

export function createTodo(title: string): Promise<CoupleTodo> {
  return withKeyLock(TODO_KEY, async () => {
    const todos = normalizeTodos(await readValue(TODO_KEY));
    const todo: CoupleTodo = {
      id: randomUUID(),
      title,
      done: false,
      doneAt: null,
      createdAt: new Date().toISOString(),
    };
    todos.push(todo);
    await writeValue(TODO_KEY, { todos });
    return todo;
  });
}

export function setTodoDone(id: string, done: boolean): Promise<CoupleTodo | null> {
  return withKeyLock(TODO_KEY, async () => {
    const todos = normalizeTodos(await readValue(TODO_KEY));
    const todo = todos.find((item) => item.id === id);
    if (!todo) return null;
    todo.done = done;
    todo.doneAt = done ? new Date().toISOString() : null;
    await writeValue(TODO_KEY, { todos });
    return todo;
  });
}

export function removeTodo(id: string): Promise<boolean> {
  return withKeyLock(TODO_KEY, async () => {
    const todos = normalizeTodos(await readValue(TODO_KEY));
    const next = todos.filter((item) => item.id !== id);
    if (next.length === todos.length) return false;
    await writeValue(TODO_KEY, { todos: next });
    return true;
  });
}

// ---------- 小约定 / 心愿 ----------

export type WishStatus = 'open' | 'accepted' | 'declined';

export interface WishReply {
  id: string;
  slot: 1 | 2;
  content: string;
  createdAt: string;
}

export interface CoupleWish {
  id: string;
  content: string;
  fromSlot: 1 | 2;
  status: WishStatus;
  respondedSlot: 1 | 2 | null;
  respondedAt: string | null;
  createdAt: string;
  // 具体文字回复（多行），双方都可以写
  replies: WishReply[];
}

export const MAX_WISH_REPLY = 300;

function normalizeReplies(raw: any): WishReply[] {
  const list: any[] = Array.isArray(raw) ? raw : [];
  const replies: WishReply[] = list
    .filter((row: any) => row && typeof row.id === 'string' && typeof row.content === 'string')
    .map((row: any) => ({
      id: row.id,
      slot: (Number(row.slot) === 2 ? 2 : 1) as 1 | 2,
      content: row.content.slice(0, MAX_WISH_REPLY),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    }));
  return replies.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function normalizeWishes(raw: Record<string, unknown> | null): CoupleWish[] {
  const list: any[] = Array.isArray((raw as any)?.wishes) ? (raw as any).wishes : [];
  const wishes: CoupleWish[] = list
    .filter((row: any) => row && typeof row.id === 'string')
    .map((row: any) => ({
      id: row.id,
      content: typeof row.content === 'string' ? row.content.slice(0, 80) : '',
      fromSlot: Number(row.fromSlot) === 2 ? 2 : 1,
      status: row.status === 'accepted' || row.status === 'declined' ? row.status : 'open',
      respondedSlot: row.respondedSlot === 2 ? 2 : row.respondedSlot === 1 ? 1 : null,
      respondedAt: typeof row.respondedAt === 'string' && row.respondedAt ? row.respondedAt : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
      replies: normalizeReplies(row.replies),
    }));
  return wishes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listWishes(): Promise<CoupleWish[]> {
  return normalizeWishes(await readValue(WISH_KEY));
}

export function createWish(content: string, fromSlot: 1 | 2): Promise<CoupleWish> {
  return withKeyLock(WISH_KEY, async () => {
    const wishes = normalizeWishes(await readValue(WISH_KEY));
    const wish: CoupleWish = {
      id: randomUUID(),
      content,
      fromSlot,
      status: 'open',
      respondedSlot: null,
      respondedAt: null,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    wishes.unshift(wish);
    await writeValue(WISH_KEY, { wishes });
    return wish;
  });
}

// 文字回复：双方都可以写，已回应/未回应都允许，用于把话说清楚
export function addWishReply(id: string, slot: 1 | 2, content: string): Promise<CoupleWish | null> {
  return withKeyLock(WISH_KEY, async () => {
    const wishes = normalizeWishes(await readValue(WISH_KEY));
    const wish = wishes.find((item) => item.id === id);
    if (!wish) return null;
    if (wish.replies.some((reply) => reply.slot === slot && reply.content === content)) return wish;
    wish.replies.push({ id: randomUUID(), slot, content, createdAt: new Date().toISOString() });
    await writeValue(WISH_KEY, { wishes });
    return wish;
  });
}

// 只有 open 状态可以回应；回应人固定为「另一方」，重复回应返回 null
export function respondWish(id: string, status: 'accepted' | 'declined'): Promise<CoupleWish | null> {
  return withKeyLock(WISH_KEY, async () => {
    const wishes = normalizeWishes(await readValue(WISH_KEY));
    const wish = wishes.find((item) => item.id === id);
    if (!wish || wish.status !== 'open') return null;
    wish.status = status;
    wish.respondedSlot = wish.fromSlot === 1 ? 2 : 1;
    wish.respondedAt = new Date().toISOString();
    await writeValue(WISH_KEY, { wishes });
    return wish;
  });
}

export function removeWish(id: string): Promise<boolean> {
  return withKeyLock(WISH_KEY, async () => {
    const wishes = normalizeWishes(await readValue(WISH_KEY));
    const next = wishes.filter((item) => item.id !== id);
    if (next.length === wishes.length) return false;
    await writeValue(WISH_KEY, { wishes: next });
    return true;
  });
}
