// 业务类型定义（与数据库表结构一一对应，字段保持 snake_case 原样返回）

// 用户资料表 profiles
export interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  points: number;
  created_at: string;
}

// 菜品分类 categories
export interface Category {
  id: number;
  name: string;
  sort: number;
}

// 规格选项（specs jsonb 内部结构）
export interface SpecOption {
  label: string;
  delta: number;
}

// 规格组
export interface DishSpec {
  name: string;
  options: SpecOption[];
}

// 菜品 dishes
export interface Dish {
  id: number;
  category_id: number;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  rating: number;
  monthly_sales: number;
  spiciness: number; // 0 不辣 / 1 微辣 / 2 中辣 / 3 特辣
  specs: DishSpec[];
  sold_out: boolean;
}

// 订单状态
export type OrderStatus = 'pending_pay' | 'preparing' | 'ready' | 'completed' | 'cancelled';

// 订单明细 order_items
export interface OrderItem {
  id: number;
  order_id: string;
  dish_id: number | null;
  dish_name: string;
  image_url: string | null;
  spec: string;
  unit_price: number;
  qty: number;
}

// 订单评价 reviews
export interface Review {
  id: number;
  order_id: string;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
}

// 订单 orders
export interface Order {
  id: string;
  order_no: string;
  user_id: string;
  status: OrderStatus;
  total: number;
  points_used: number;
  points_earned: number;
  remark: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  review: Review | null;
}

// 签到记录 sign_ins
export interface SignIn {
  id: number;
  user_id: string;
  sign_date: string;
  points: number;
  streak: number;
}

// 积分明细 points_logs
export interface PointsLog {
  id: number;
  user_id: string;
  change: number;
  reason: string;
  created_at: string;
}
