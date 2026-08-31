// 订单相关路由：下单 / 列表 / 详情 / 支付 / 取消 / 确认 / 评价
import { Router, Request, Response } from 'express';
import { adminClient } from '../lib/supabase';
import { ok, fail } from '../utils/resp';
import { requireAuth } from '../middleware/auth';
import { computeUnitPrice } from '../utils/order';
import { Dish, Order } from '../types';

const router = Router();

// 生成订单号：'NO' + 年月日时分秒 + 4 位随机数字
function genOrderNo(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `NO${ts}${rand}`;
}

// 订单行映射：order_items → items、reviews[0] → review（返回前删除原嵌套键），数字字段转 Number
function mapOrder(row: any): Order {
  const copy = { ...row };
  const reviews = copy.reviews;
  const orderItems = copy.order_items || [];
  delete copy.reviews;
  delete copy.order_items;
  return {
    ...copy,
    total: Number(copy.total) || 0,
    points_used: Number(copy.points_used) || 0,
    points_earned: Number(copy.points_earned) || 0,
    items: orderItems.map((it: any) => ({
      ...it,
      unit_price: Number(it.unit_price) || 0,
      qty: Number(it.qty) || 0,
    })),
    review: (reviews && reviews[0]) || null,
  };
}

// 查询订单（含明细与评价）
async function loadOrder(id: string) {
  return adminClient
    .from('orders')
    .select('*,order_items(*),reviews(*)')
    .eq('id', id)
    .maybeSingle();
}

// 读取用户当前积分
async function readUserPoints(userId: string): Promise<number> {
  const { data } = await adminClient.from('profiles').select('points').eq('id', userId).maybeSingle();
  return Number(data?.points) || 0;
}

// 写回用户积分
async function writeUserPoints(userId: string, points: number): Promise<void> {
  await adminClient.from('profiles').update({ points }).eq('id', userId);
}

// 下单
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { items, remark, pointsUsed: rawPointsUsed } = req.body || {};

  // 校验 items：非空、qty 1~99
  if (!Array.isArray(items) || items.length === 0) {
    fail(res, 400, '订单明细不能为空');
    return;
  }
  for (const it of items) {
    const qty = Number(it?.qty);
    if (!it?.dishId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      fail(res, 400, '订单明细不合法（qty 需为 1~99 的整数）');
      return;
    }
  }

  // 批量查询菜品（in），校验存在性与售罄状态
  const dishIds = Array.from(new Set(items.map((it: any) => Number(it.dishId))));
  const { data: dishRows, error: dishError } = await adminClient.from('dishes').select('*').in('id', dishIds);
  if (dishError) {
    fail(res, 500, dishError.message);
    return;
  }
  const dishMap = new Map<number, Dish>();
  for (const row of dishRows || []) dishMap.set(Number(row.id), row as Dish);
  for (const it of items) {
    const dish = dishMap.get(Number(it.dishId));
    if (!dish) {
      fail(res, 400, '存在无效的菜品');
      return;
    }
    if (dish.sold_out) {
      fail(res, 400, `菜品「${dish.name}」已售罄`);
      return;
    }
  }

  // 计算单价（price + 规格加价）与总价（保留 2 位小数）
  let total = 0;
  const calcItems = items.map((it: any) => {
    const dish = dishMap.get(Number(it.dishId)) as Dish;
    const unitPrice = computeUnitPrice(dish, it.spec);
    const qty = Number(it.qty);
    total += unitPrice * qty;
    return { dish, spec: String(it.spec || ''), unitPrice, qty };
  });
  total = Math.round(total * 100) / 100;

  // 校验积分抵扣：整数、≥0、≤ 用户积分、≤ floor(total/2)*10（10 积分抵 1 元）
  const pointsUsed =
    rawPointsUsed === undefined || rawPointsUsed === null || rawPointsUsed === '' ? 0 : Number(rawPointsUsed);
  if (!Number.isInteger(pointsUsed) || pointsUsed < 0) {
    fail(res, 400, '积分抵扣数量不合法');
    return;
  }
  const maxPoints = Math.floor(total / 2) * 10;
  if (pointsUsed > maxPoints) {
    fail(res, 400, `积分抵扣超出上限，本单最多可用 ${maxPoints} 积分`);
    return;
  }
  const userPoints = await readUserPoints(userId);
  if (pointsUsed > userPoints) {
    fail(res, 400, '积分不足');
    return;
  }

  // 实付金额与可得积分
  const paid = total - pointsUsed / 10;
  const pointsEarned = Math.floor(paid);

  // 写入订单主表
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .insert({
      order_no: genOrderNo(),
      user_id: userId,
      status: 'pending_pay',
      total,
      points_used: pointsUsed,
      points_earned: pointsEarned,
      remark: remark ? String(remark) : '',
      paid_at: null,
    })
    .select('*')
    .single();
  if (orderError || !order) {
    fail(res, 500, orderError?.message || '创建订单失败');
    return;
  }

  // 批量写入订单明细（保存菜品名/图片快照）
  const itemRows = calcItems.map((it) => ({
    order_id: order.id,
    dish_id: it.dish.id,
    dish_name: it.dish.name,
    image_url: it.dish.image_url,
    spec: it.spec,
    unit_price: it.unitPrice,
    qty: it.qty,
  }));
  const { error: itemsError } = await adminClient.from('order_items').insert(itemRows);
  if (itemsError) {
    fail(res, 500, itemsError.message);
    return;
  }

  // 积分抵扣：扣减用户积分并记录流水
  if (pointsUsed > 0) {
    await writeUserPoints(userId, userPoints - pointsUsed);
    await adminClient.from('points_logs').insert({
      user_id: userId,
      change: -pointsUsed,
      reason: '下单积分抵扣',
    });
  }

  // 重新查询完整订单（含 items）返回
  const { data: fullOrder } = await loadOrder(order.id);
  ok(res, mapOrder(fullOrder || { ...order, order_items: itemRows, reviews: [] }));
});

// 订单列表：先自动推进状态（模拟后厨 20 秒出餐），再分页查询
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const status = req.query.status ? String(req.query.status) : 'all';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));

  // 制作中且支付已超过 20 秒的订单自动置为待取餐
  const readyBefore = new Date(Date.now() - 20000).toISOString();
  await adminClient
    .from('orders')
    .update({ status: 'ready' })
    .eq('user_id', userId)
    .eq('status', 'preparing')
    .lt('paid_at', readyBefore);

  // 分页查询订单
  let query: any = adminClient.from('orders').select('*,order_items(*),reviews(*)').eq('user_id', userId);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    fail(res, 500, error.message);
    return;
  }

  // 单独查询总数
  let countQuery: any = adminClient.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (status !== 'all') countQuery = countQuery.eq('status', status);
  const { count } = await countQuery;

  ok(res, { list: (data || []).map(mapOrder), total: count || 0 });
});

// 订单详情：归属校验
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { data, error } = await loadOrder(req.params.id);
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!data) {
    fail(res, 404, '订单不存在');
    return;
  }
  if (data.user_id !== userId) {
    fail(res, 403, '无权访问该订单');
    return;
  }
  ok(res, mapOrder(data));
});

// 支付订单：仅待支付可支付
router.post('/:id/pay', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { data: order, error } = await loadOrder(req.params.id);
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!order) {
    fail(res, 404, '订单不存在');
    return;
  }
  if (order.user_id !== userId) {
    fail(res, 403, '无权操作该订单');
    return;
  }
  if (order.status !== 'pending_pay') {
    fail(res, 400, '当前状态不可支付');
    return;
  }
  const { data: updated, error: updateError } = await adminClient
    .from('orders')
    .update({ status: 'preparing', paid_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (updateError || !updated) {
    fail(res, 500, updateError?.message || '支付失败');
    return;
  }
  ok(res, mapOrder({ ...updated, order_items: order.order_items, reviews: order.reviews }));
});

// 取消订单：仅待支付可取消，已用积分退还
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { data: order, error } = await loadOrder(req.params.id);
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!order) {
    fail(res, 404, '订单不存在');
    return;
  }
  if (order.user_id !== userId) {
    fail(res, 403, '无权操作该订单');
    return;
  }
  if (order.status !== 'pending_pay') {
    fail(res, 400, '当前状态不可取消');
    return;
  }
  const { data: updated, error: updateError } = await adminClient
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (updateError || !updated) {
    fail(res, 500, updateError?.message || '取消失败');
    return;
  }
  // 退还积分并记录流水
  const pointsUsed = Number(order.points_used) || 0;
  if (pointsUsed > 0) {
    const userPoints = await readUserPoints(userId);
    await writeUserPoints(userId, userPoints + pointsUsed);
    await adminClient.from('points_logs').insert({
      user_id: userId,
      change: pointsUsed,
      reason: '取消订单退还积分',
    });
  }
  ok(res, mapOrder({ ...updated, order_items: order.order_items, reviews: order.reviews }));
});

// 确认取餐：仅待取餐可确认，发放订单积分奖励
router.post('/:id/confirm', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { data: order, error } = await loadOrder(req.params.id);
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!order) {
    fail(res, 404, '订单不存在');
    return;
  }
  if (order.user_id !== userId) {
    fail(res, 403, '无权操作该订单');
    return;
  }
  if (order.status !== 'ready') {
    fail(res, 400, '当前状态不可确认取餐');
    return;
  }
  const { data: updated, error: updateError } = await adminClient
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (updateError || !updated) {
    fail(res, 500, updateError?.message || '确认失败');
    return;
  }
  // 发放积分奖励并记录流水
  const pointsEarned = Number(order.points_earned) || 0;
  if (pointsEarned > 0) {
    const userPoints = await readUserPoints(userId);
    await writeUserPoints(userId, userPoints + pointsEarned);
    await adminClient.from('points_logs').insert({
      user_id: userId,
      change: pointsEarned,
      reason: '订单完成奖励',
    });
  }
  ok(res, mapOrder({ ...updated, order_items: order.order_items, reviews: order.reviews }));
});

// 评价订单：仅已完成且未评价过
router.post('/:id/review', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId as string;
  const { rating, content } = req.body || {};
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    fail(res, 400, '评分需为 1~5 的整数');
    return;
  }
  const { data: order, error } = await loadOrder(req.params.id);
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  if (!order) {
    fail(res, 404, '订单不存在');
    return;
  }
  if (order.user_id !== userId) {
    fail(res, 403, '无权操作该订单');
    return;
  }
  if (order.status !== 'completed') {
    fail(res, 400, '仅已完成订单可评价');
    return;
  }
  if (order.reviews && order.reviews.length > 0) {
    fail(res, 409, '该订单已评价');
    return;
  }
  const { data: review, error: insertError } = await adminClient
    .from('reviews')
    .insert({
      order_id: order.id,
      user_id: userId,
      rating: ratingNum,
      content: content === undefined || content === null ? '' : String(content),
    })
    .select('*')
    .single();
  if (insertError || !review) {
    fail(res, 500, insertError?.message || '评价失败');
    return;
  }
  ok(res, review);
});

export default router;
