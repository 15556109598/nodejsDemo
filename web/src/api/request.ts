// ============================================
// axios 请求封装：统一解包 {code:0,data,message}、token 注入、错误提示
// ============================================
import axios, { type AxiosRequestConfig } from 'axios'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import router from '@/router'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 10000,
})

// 请求拦截器：附加 Authorization
instance.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

// 响应拦截器：统一错误提示 + 解包 data
instance.interceptors.response.use(
  (response) => {
    const body = response.data
    // HTTP 2xx 但业务码非 0
    if (!body || body.code !== 0) {
      showToast(body?.message || '请求失败')
      return Promise.reject(new Error(body?.message || '请求失败'))
    }
    return body.data
  },
  (error) => {
    const status = error.response?.status
    // 401：登录失效，清空用户并跳登录页
    if (status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      router.replace({ path: '/login' })
    }
    showToast(error.response?.data?.message || '网络异常')
    return Promise.reject(error)
  }
)

// 泛型请求：Promise 直接返回解包后的 data
export function http<T>(config: AxiosRequestConfig): Promise<T> {
  return instance.request<T, T>(config)
}

export default instance
