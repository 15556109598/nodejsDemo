// ============================================
// 业务 API（Promise 直接返回解包后的 data）
// ============================================
import { http } from './request'
import type {
  UserProfile,
  LoginResult,
  Category,
  Dish,
  Order,
  OrderStatus,
  Review,
  PageResult,
  PointsLog,
  SignResult,
  SignInfo,
} from './types'

// 认证
export const authApi = {
  register(data: { email: string; password: string; nickname: string }) {
    return http<LoginResult>({ url: '/auth/register', method: 'POST', data })
  },
  login(data: { email: string; password: string }) {
    return http<LoginResult>({ url: '/auth/login', method: 'POST', data })
  },
  me() {
    return http<UserProfile>({ url: '/auth/me' })
  },
}

// 菜单
export const menuApi = {
  categories() {
    return http<Category[]>({ url: '/categories' })
  },
  dishes(params?: { categoryId?: number; keyword?: string }) {
    return http<Dish[]>({ url: '/dishes', params })
  },
  dish(id: number) {
    return http<Dish>({ url: `/dishes/${id}` })
  },
}

// 订单
export const orderApi = {
  create(data: { items: { dishId: number; spec: string; qty: number }[]; remark: string; pointsUsed: number }) {
    return http<Order>({ url: '/orders', method: 'POST', data })
  },
  list(params: { status: 'all' | OrderStatus; page: number; pageSize: number }) {
    return http<PageResult<Order>>({ url: '/orders', params })
  },
  detail(id: number | string) {
    return http<Order>({ url: `/orders/${id}` })
  },
  pay(id: number | string) {
    return http<Order>({ url: `/orders/${id}/pay`, method: 'POST' })
  },
  cancel(id: number | string) {
    return http<Order>({ url: `/orders/${id}/cancel`, method: 'POST' })
  },
  confirm(id: number | string) {
    return http<Order>({ url: `/orders/${id}/confirm`, method: 'POST' })
  },
  review(id: number | string, data: { rating: number; content: string }) {
    return http<Review>({ url: `/orders/${id}/review`, method: 'POST', data })
  },
}

// 每日签到
export const signinApi = {
  sign() {
    return http<SignResult>({ url: '/signin', method: 'POST' })
  },
  info(params: { year: number; month: number }) {
    return http<SignInfo>({ url: '/signin', params })
  },
}

// 积分明细
export const pointsApi = {
  logs(params: { page: number; pageSize: number }) {
    return http<PageResult<PointsLog>>({ url: '/points/logs', params })
  },
}
