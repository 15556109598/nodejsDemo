// 零食日期管理：Supabase Postgres（记录/设置）+ Storage（图片）
// 服务端统一使用 service_role，匿名用户只通过本服务接口读写
import crypto from 'crypto';
import { adminClient } from '../lib/supabase';
import { env } from '../env';

export interface SnackItem {
  id: string;
  name: string;
  brand: string;
  quantity: number;
  // 到期日（YYYY-MM-DD）
  expireDate: string;
  note: string;
  // Supabase Storage 公开地址
  photoUrl: string;
  finished: boolean;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnackSettings {
  nearDays: number;
}

export interface SnackInput {
  name: string;
  brand: string;
  quantity: number;
  expireDate: string;
  note: string;
  photoUrl: string;
}

// 表名 / 桶名（桶名可用 SNACKS_BUCKET 覆盖）
const TABLE = 'snacks';
const SETTINGS_TABLE = 'app_settings';
const SETTINGS_KEY = 'snacks';
export const BUCKET = env.SNACKS_BUCKET;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

interface SnackRow {
  id: string;
  name: string;
  brand: string;
  quantity: number;
  expire_date: string;
  note: string;
  photo_url: string;
  finished: boolean;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: SnackRow): SnackItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    quantity: row.quantity,
    expireDate: String(row.expire_date).slice(0, 10),
    note: row.note,
    photoUrl: row.photo_url,
    finished: row.finished,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 保留数据库错误码，便于上层区分「表未创建」等可操作错误
function raise(error: any): never {
  const err = new Error(error?.message || '数据库操作失败') as Error & { code?: string };
  err.code = error?.code;
  throw err;
}

// 默认按到期日由近到远，已吃完的排在最后（归档时间倒序）
function sortItems(items: SnackItem[]): SnackItem[] {
  return items.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? 1 : -1;
    if (a.finished && b.finished) {
      return (b.finishedAt || '').localeCompare(a.finishedAt || '');
    }
    return a.expireDate.localeCompare(b.expireDate);
  });
}

export async function listSnacks(): Promise<SnackItem[]> {
  const { data, error } = await adminClient.from(TABLE).select('*');
  if (error) raise(error);
  return sortItems((data as SnackRow[]).map(mapRow));
}

export async function createSnack(input: SnackInput): Promise<SnackItem> {
  const { data, error } = await adminClient
    .from(TABLE)
    .insert({
      name: input.name,
      brand: input.brand,
      quantity: input.quantity,
      expire_date: input.expireDate,
      note: input.note,
      photo_url: input.photoUrl,
      finished: false,
    })
    .select('*')
    .single();
  if (error) raise(error);
  return mapRow(data as SnackRow);
}

export async function updateSnack(id: string, input: Partial<SnackInput>): Promise<SnackItem | null> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.expireDate !== undefined) patch.expire_date = input.expireDate;
  if (input.note !== undefined) patch.note = input.note;
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl;

  const { data, error } = await adminClient
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) raise(error);
  return data ? mapRow(data as SnackRow) : null;
}

export async function setFinished(id: string, finished: boolean): Promise<SnackItem | null> {
  const { data, error } = await adminClient
    .from(TABLE)
    .update({ finished, finished_at: finished ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) raise(error);
  return data ? mapRow(data as SnackRow) : null;
}

export async function removeSnack(id: string): Promise<SnackItem | null> {
  // 先取记录，删除后清理 Storage 里的图片（取不到则视为不存在）
  const { data, error } = await adminClient
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) raise(error);
  if (!data) return null;

  const item = mapRow(data as SnackRow);
  if (item.photoUrl) {
    const path = storagePathFromUrl(item.photoUrl);
    if (path) {
      const { error: storageError } = await adminClient.storage.from(BUCKET).remove([path]);
      if (storageError) console.warn('[snacks] 删除图片失败:', storageError.message);
    }
  }
  return item;
}

export async function getSettings(): Promise<SnackSettings> {
  const { data, error } = await adminClient
    .from(SETTINGS_TABLE)
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();
  if (error) raise(error);
  const nearDays = Number((data?.value as any)?.nearDays);
  return { nearDays: nearDays >= 1 && nearDays <= 60 ? nearDays : env.NEAR_DAYS || 7 };
}

export async function setNearDays(nearDays: number): Promise<SnackSettings> {
  const { error } = await adminClient
    .from(SETTINGS_TABLE)
    .upsert({ key: SETTINGS_KEY, value: { nearDays }, updated_at: new Date().toISOString() });
  if (error) raise(error);
  return { nearDays };
}

// 校验图片真实类型（魔数），防止改扩展名上传非图片文件
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export interface SavePhotoResult {
  url?: string;
  error?: string;
  status?: number;
}

// 上传到 Storage：随机文件名 + 白名单校验 + 大小上限
export async function savePhoto(buffer: Buffer, declaredMime: string): Promise<SavePhotoResult> {
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

  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const { error } = await adminClient.storage.from(BUCKET).upload(path, buffer, {
    contentType: EXT_MIME[ext],
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) {
    return { error: `图片上传失败：${error.message}`, status: 502 };
  }
  const { data } = adminClient.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

// 从 Storage 公开地址解析对象路径
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
