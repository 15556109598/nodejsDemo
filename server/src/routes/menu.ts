// 菜单相关路由：分类 / 菜品列表 / 菜品详情
import { Router, Request, Response } from 'express';
import { adminClient } from '../lib/supabase';
import { ok, fail } from '../utils/resp';
import { Dish } from '../types';

const router = Router();

// 数字字段转换（numeric 类型转 JS Number）
function mapDish(row: any): Dish {
  return {
    ...row,
    price: Number(row.price) || 0,
    rating: Number(row.rating) || 0,
    monthly_sales: Number(row.monthly_sales) || 0,
    spiciness: Number(row.spiciness) || 0,
  };
}

// 分类列表（sort 升序）
router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await adminClient.from('categories').select('*').order('sort', { ascending: true });
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  ok(res, data || []);
});

// 菜品列表：支持 categoryId 过滤与 keyword 模糊搜索（name/description ilike），按 id 升序
router.get('/dishes', async (req: Request, res: Response): Promise<void> => {
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : '';
  const keyword = req.query.keyword ? String(req.query.keyword) : '';

  let query: any = adminClient.from('dishes').select('*').order('id', { ascending: true });
  if (categoryId && !Number.isNaN(Number(categoryId))) {
    query = query.eq('category_id', Number(categoryId));
  }
  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }
  const { data, error } = await query;
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  ok(res, (data || []).map(mapDish));
});

// 菜品详情
router.get('/dishes/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    fail(res, 404, '菜品不存在');
    return;
  }
  const { data, error } = await adminClient.from('dishes').select('*').eq('id', id).maybeSingle();
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!data) {
    fail(res, 404, '菜品不存在');
    return;
  }
  ok(res, mapDish(data));
});

export default router;
