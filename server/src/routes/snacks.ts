// 零食日期管理接口：无需登录，所有人共享同一份数据
// GET    /api/snacks            列表 + 设置
// PUT    /api/snacks/settings   修改临近过期阈值
// POST   /api/snacks/photo      上传图片（原始二进制，Content-Type 为图片 MIME）
// POST   /api/snacks            新增记录
// PUT    /api/snacks/:id        编辑记录
// POST   /api/snacks/:id/finish 标记吃完 / 取消归档
// DELETE /api/snacks/:id        删除记录
import express, { Request, Response, Router } from 'express';
import { ok, fail } from '../utils/resp';
import {
  MAX_PHOTO_BYTES,
  createSnack,
  getSettings,
  listSnacks,
  removeSnack,
  savePhoto,
  setFinished,
  setNearDays,
  updateSnack,
  type SnackInput,
} from '../store/snacks';

const router = Router();

const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// 日期合法性：YYYY-MM-DD 且为真实存在的日期
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

// 字段校验：返回错误信息或 null
function validateInput(body: any, partial = false): { error?: string; data?: Partial<SnackInput> } {
  const data: Partial<SnackInput> = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) return { error: '请填写零食名称' };
    if (name.length > 50) return { error: '名称最多 50 个字符' };
    data.name = name;
  }

  if (!partial || body.brand !== undefined) {
    const brand = String(body.brand ?? '').trim();
    if (brand.length > 50) return { error: '品类/品牌最多 50 个字符' };
    data.brand = brand;
  }

  if (!partial || body.quantity !== undefined) {
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return { error: '数量需为 1~999 的整数' };
    }
    data.quantity = quantity;
  }

  if (!partial || body.expireDate !== undefined) {
    const expireDate = String(body.expireDate ?? '').trim();
    if (!isValidDate(expireDate)) return { error: '请选择合法的到期日期' };
    data.expireDate = expireDate;
  }

  if (!partial || body.note !== undefined) {
    const note = String(body.note ?? '').trim();
    if (note.length > 200) return { error: '备注最多 200 个字符' };
    data.note = note;
  }

  if (!partial || body.photoUrl !== undefined) {
    const photoUrl = String(body.photoUrl ?? '').trim();
    // 只接受本服务上传目录内的相对地址，避免写入外部链接
    if (photoUrl && !/^\/uploads\/snacks\/[A-Za-z0-9._-]+$/.test(photoUrl)) {
      return { error: '图片地址不合法' };
    }
    data.photoUrl = photoUrl;
  }

  return { data };
}

// 默认按到期日由近到远排序（已吃完的排在最后）
function sortItems<T extends { expireDate: string; finished: boolean; finishedAt: string | null }>(items: T[]): T[] {
  return items.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? 1 : -1;
    if (a.finished && b.finished) {
      return (b.finishedAt || '').localeCompare(a.finishedAt || '');
    }
    return a.expireDate.localeCompare(b.expireDate);
  });
}

// 列表（附带设置，前端据 nearDays 计算状态）
router.get('/', (_req: Request, res: Response): void => {
  ok(res, { items: sortItems(listSnacks()), settings: getSettings() });
});

// 修改临近过期阈值
router.put('/settings', (req: Request, res: Response): void => {
  const nearDays = Number(req.body?.nearDays);
  if (!Number.isInteger(nearDays) || nearDays < 1 || nearDays > 60) {
    fail(res, 400, '提醒阈值需为 1~60 天');
    return;
  }
  ok(res, setNearDays(nearDays));
});

// 图片上传：原始二进制（express.raw），校验 MIME 白名单 + 文件头 + 大小上限
router.post(
  '/photo',
  express.raw({ type: PHOTO_MIMES, limit: MAX_PHOTO_BYTES }),
  (req: Request, res: Response): void => {
    const mime = String(req.headers['content-type'] || '');
    if (!PHOTO_MIMES.includes(mime.split(';')[0].trim().toLowerCase())) {
      fail(res, 415, '仅支持 JPG / PNG / WEBP / GIF 格式');
      return;
    }
    const result = savePhoto(req.body as Buffer, mime);
    if (result.error || !result.url) {
      fail(res, result.status || 400, result.error || '图片保存失败');
      return;
    }
    ok(res, { url: result.url });
  }
);

// 新增
router.post('/', (req: Request, res: Response): void => {
  const { error, data } = validateInput(req.body || {});
  if (error || !data) {
    fail(res, 400, error || '参数不合法');
    return;
  }
  ok(res, createSnack(data as SnackInput));
});

// 编辑
router.put('/:id', (req: Request, res: Response): void => {
  const { error, data } = validateInput(req.body || {}, true);
  if (error || !data) {
    fail(res, 400, error || '参数不合法');
    return;
  }
  const item = updateSnack(req.params.id, data);
  if (!item) {
    fail(res, 404, '记录不存在');
    return;
  }
  ok(res, item);
});

// 标记吃完 / 取消归档
router.post('/:id/finish', (req: Request, res: Response): void => {
  const finished = req.body?.finished === undefined ? true : Boolean(req.body.finished);
  const item = setFinished(req.params.id, finished);
  if (!item) {
    fail(res, 404, '记录不存在');
    return;
  }
  ok(res, item);
});

// 删除
router.delete('/:id', (req: Request, res: Response): void => {
  const item = removeSnack(req.params.id);
  if (!item) {
    fail(res, 404, '记录不存在');
    return;
  }
  ok(res, { id: item.id });
});

export default router;
