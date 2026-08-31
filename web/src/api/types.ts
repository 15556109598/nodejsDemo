// ============================================
// API 类型定义（与后端契约严格一致，行数据 snake_case）
// ============================================

// 用户信息
export interface UserProfile {
  id: string
  email: string
  nickname: string
  avatar_url: string | null
  points: number
}

// 规格
export interface SpecOption {
  label: string
  delta: number
}

export interface Spec {
  name: string
  options: SpecOption[]
}

// 菜品
export interface Dish {
  id: number
  category_id: number
  name: string
  description: string
  image_url: string
  price: number
  rating: number
  monthly_sales: number
  spiciness: number
  specs: Spec[]
  sold_out: boolean
}

// 分类
export interface Category {
  id: number
  name: string
  sort: number
}

// 本地购物车条目
export interface CartItem {
  dishId: number
  name: string
  image_url: string
  spec: string
  unitPrice: number
  qty: number
}

// 订单状态
export type OrderStatus = 'pending_pay' | 'preparing' | 'ready' | 'completed' | 'cancelled'

// 订单明细
export interface OrderItem {
  id: number
  order_id: number
  dish_id: number
  dish_name: string
  image_url: string
  spec: string
  unit_price: number
  qty: number
}

// 评价
export interface Review {
  id: number
  order_id: number
  user_id: string
  rating: number
  content: string
  created_at: string
}

// 订单
export interface Order {
  id: number
  order_no: string
  user_id: string
  status: OrderStatus
  total: number
  points_used: number
  points_earned: number
  remark: string
  paid_at: string | null
  created_at: string
  items?: OrderItem[]
  review?: Review | null
}

// 积分流水
export interface PointsLog {
  id: number
  change: number
  reason: string
  created_at: string
}

// 登录/注册返回
export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: UserProfile
}

// 通用分页返回
export interface PageResult<T> {
  list: T[]
  total: number
}

// 签到
export interface SignResult {
  pointsGained: number
  bonusGained: number
  streak: number
  points: number
}

export interface SignInfo {
  dates: { date: string; points: number }[]
  monthSigned: number
  totalSigned: number
  streak: number
  points: number
}
