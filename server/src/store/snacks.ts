// 零食日期管理：JSON 文件持久化 + 图片落地存储
// 单人/小团队场景，进程内缓存 + 原子写（临时文件 rename），避免高并发写坏文件
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../env';

export interface SnackItem {
  id: string;
  name: string;
  brand: string;
  quantity: number;
  // 到期日（YYYY-MM-DD，仅日期，不含时区）
  expireDate: string;
  note: string;
  // 形如 /uploads/snacks/xxx.jpg，前端按 API 域名拼接
  photoUrl: string;
  // 是否已吃完归档
  finished: boolean;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnackSettings {
  // 临近过期阈值（天）
  nearDays: number;
}

interface SnackDB {
  version: number;
  settings: SnackSettings;
  items: SnackItem[];
}

const DATA_FILE = path.join(env.DATA_DIR, 'snacks.json');
export const PHOTO_DIR = path.join(env.UPLOAD_DIR, 'snacks');

// 图片白名单：MIME → 扩展名
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

let cache: SnackDB | null = null;

function ensureDirs(): void {
  fs.mkdirSync(env.DATA_DIR, { recursive: true });
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

function defaultDB(): SnackDB {
  return { version: 1, settings: { nearDays: env.NEAR_DAYS > 0 ? env.NEAR_DAYS : 7 }, items: [] };
}

function load(): SnackDB {
  if (cache) return cache;
  ensureDirs();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SnackDB;
    cache = {
      version: parsed.version || 1,
      settings: { nearDays: Number(parsed.settings?.nearDays) || 7 },
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    // 文件不存在或损坏（首次启动）：使用空数据
    cache = defaultDB();
  }
  return cache;
}

function persist(): void {
  const db = load();
  ensureDirs();
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmp, DATA_FILE);
}

function nowISO(): string {
  return new Date().toISOString();
}

export function getSettings(): SnackSettings {
  return { ...load().settings };
}

export function setNearDays(nearDays: number): SnackSettings {
  const db = load();
  db.settings.nearDays = nearDays;
  persist();
  return getSettings();
}

export function listSnacks(): SnackItem[] {
  return load().items.slice();
}

export function getSnack(id: string): SnackItem | undefined {
  return load().items.find((it) => it.id === id);
}

export interface SnackInput {
  name: string;
  brand: string;
  quantity: number;
  expireDate: string;
  note: string;
  photoUrl: string;
}

export function createSnack(input: SnackInput): SnackItem {
  const db = load();
  const ts = nowISO();
  const item: SnackItem = {
    id: crypto.randomUUID(),
    ...input,
    finished: false,
    finishedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.items.push(item);
  persist();
  return item;
}

export function updateSnack(id: string, input: Partial<SnackInput>): SnackItem | undefined {
  const db = load();
  const item = db.items.find((it) => it.id === id);
  if (!item) return undefined;
  Object.assign(item, input, { updatedAt: nowISO() });
  persist();
  return item;
}

export function setFinished(id: string, finished: boolean): SnackItem | undefined {
  const db = load();
  const item = db.items.find((it) => it.id === id);
  if (!item) return undefined;
  item.finished = finished;
  item.finishedAt = finished ? nowISO() : null;
  item.updatedAt = nowISO();
  persist();
  return item;
}

export function removeSnack(id: string): SnackItem | undefined {
  const db = load();
  const index = db.items.findIndex((it) => it.id === id);
  if (index < 0) return undefined;
  const [removed] = db.items.splice(index, 1);
  persist();
  // 没有其它记录引用该图片时才删除文件
  if (removed.photoUrl && !db.items.some((it) => it.photoUrl === removed.photoUrl)) {
    removePhotoFile(removed.photoUrl);
  }
  return removed;
}

function removePhotoFile(photoUrl: string): void {
  if (!photoUrl.startsWith('/uploads/snacks/')) return;
  const filename = path.basename(photoUrl);
  try {
    fs.unlinkSync(path.join(PHOTO_DIR, filename));
  } catch {
    // 文件不存在时忽略
  }
}

// 校验图片的真实类型（魔数），防止改扩展名上传非图片文件
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  // GIF: GIF8
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  // WEBP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export interface SavePhotoResult {
  url?: string;
  error?: string;
  status?: number;
}

export function savePhoto(buffer: Buffer, declaredMime: string): SavePhotoResult {
  const mime = declaredMime.split(';')[0].trim().toLowerCase();
  if (!MIME_EXT[mime]) {
    return { error: '仅支持 JPG / PNG / WEBP / GIF 格式', status: 415 };
  }
  if (!buffer || buffer.length === 0) {
    return { error: '图片内容为空', status: 400 };
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    return { error: '图片大小不能超过 5MB', status: 413 };
  }
  const ext = sniffImageExt(buffer);
  if (!ext) {
    return { error: '图片内容不合法（文件头校验失败）', status: 400 };
  }
  ensureDirs();
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(PHOTO_DIR, filename), buffer);
  return { url: `/uploads/snacks/${filename}` };
}

// 进程启动时清理上传目录里无法解析的残留（如写入中断）
export function ensureStorageReady(): void {
  ensureDirs();
  load();
}
