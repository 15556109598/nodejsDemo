// 路由配置：全部懒加载 + 登录守卫
// 说明：'/' 为模块导航入口页（公开），点餐系统整体挂在 '/app' 下，零食模块为 '/snacks'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 无需登录即可访问的路径（模块入口页、零食模块、情侣空间、登录页）
// 说明：情侣空间另有自己的口令门（服务端 cookie），不依赖点餐登录态
const PUBLIC_PATHS = ['/', '/snacks', '/couple', '/login']

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'portal',
    component: () => import('@/views/portal/Index.vue'),
    meta: { title: '小厨应用中心' },
  },
  {
    path: '/app',
    name: 'home',
    component: () => import('@/views/home/Index.vue'),
    meta: { tabbar: true, keepAlive: true, title: '小厨点餐' },
  },
  {
    path: '/snacks',
    name: 'snacks',
    component: () => import('@/views/snacks/Index.vue'),
  },
  {
    path: '/couple',
    name: 'couple',
    component: () => import('@/views/couple/Index.vue'),
  },
  {
    path: '/order',
    name: 'order',
    component: () => import('@/views/order/List.vue'),
    meta: { tabbar: true, title: '小厨点餐' },
  },
  {
    path: '/mine',
    name: 'mine',
    component: () => import('@/views/mine/Index.vue'),
    meta: { tabbar: true, title: '小厨点餐' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/Login.vue'),
    meta: { title: '小厨点餐' },
  },
  {
    path: '/order/:id',
    name: 'order-detail',
    component: () => import('@/views/order/Detail.vue'),
    meta: { title: '小厨点餐' },
  },
  {
    path: '/points',
    name: 'points',
    component: () => import('@/views/mine/PointsLog.vue'),
    meta: { title: '小厨点餐' },
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

// 浏览器标签标题：按路由 meta 设置，未配置的页面沿用站点默认标题
router.afterEach((to) => {
  document.title = (to.meta.title as string | undefined) || '小厨点餐'
})

export default router
