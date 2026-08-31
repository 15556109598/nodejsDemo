// 路由配置：全部懒加载 + 登录守卫
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/home/Index.vue'),
    meta: { tabbar: true, keepAlive: true },
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

// 全局前置守卫：无 token 一律跳登录页
router.beforeEach((to) => {
  const userStore = useUserStore()
  if (!userStore.token && to.path !== '/login') {
    return { path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
})

export default router
