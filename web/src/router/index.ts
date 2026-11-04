// 路由配置：全部懒加载 + 登录守卫
// 说明：'/' 为模块导航入口页（公开），点餐系统整体挂在 '/app' 下，零食模块为 '/snacks'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 无需登录即可访问的路径（模块入口页、零食模块、登录页）
const PUBLIC_PATHS = ['/', '/snacks', '/login']

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'portal',
    component: () => import('@/views/portal/Index.vue'),
  },
  {
    path: '/app',
    name: 'home',
    component: () => import('@/views/home/Index.vue'),
    meta: { tabbar: true, keepAlive: true },
  },
  {
    path: '/snacks',
    name: 'snacks',
    component: () => import('@/views/snacks/Index.vue'),
  },
  {
    path: '/order',
    name: 'order',
    component: () => import('@/views/order/List.vue'),
    meta: { tabbar: true },
  },
  {
    path: '/mine',
    name: 'mine',
    component: () => import('@/views/mine/Index.vue'),
    meta: { tabbar: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/Login.vue'),
  },
  {
    path: '/order/:id',
    name: 'order-detail',
    component: () => import('@/views/order/Detail.vue'),
  },
  {
    path: '/points',
    name: 'points',
    component: () => import('@/views/mine/PointsLog.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 全局前置守卫：公开页面直接放行，其余无 token 一律跳登录页
router.beforeEach((to) => {
  const userStore = useUserStore()
  if (!userStore.token && !PUBLIC_PATHS.includes(to.path)) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
