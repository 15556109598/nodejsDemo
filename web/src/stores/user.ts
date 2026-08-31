// 用户状态：token / profile，localStorage('xichu_user') 持久化
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api'
import type { UserProfile } from '@/api/types'

const STORAGE_KEY = 'xichu_user'

function loadSaved(): { token: string; refreshToken: string; profile: UserProfile | null } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { token: '', refreshToken: '', profile: null }
  } catch {
    return { token: '', refreshToken: '', profile: null }
  }
}

export const useUserStore = defineStore('user', () => {
  const saved = loadSaved()

  const token = ref<string>(saved.token || '')
  const refreshToken = ref<string>(saved.refreshToken || '')
  const profile = ref<UserProfile | null>(saved.profile || null)

  // 持久化到 localStorage
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token.value, refreshToken: refreshToken.value, profile: profile.value }))
  }

  // 注册（成功即登录）
  async function register(payload: { email: string; password: string; nickname: string }) {
    const data = await authApi.register(payload)
    token.value = data.accessToken
    refreshToken.value = data.refreshToken
    profile.value = data.user
    persist()
    return data
  }

  // 登录
  async function login(payload: { email: string; password: string }) {
    const data = await authApi.login(payload)
    token.value = data.accessToken
    refreshToken.value = data.refreshToken
    profile.value = data.user
    persist()
    return data
  }

  // 拉取最新用户信息
  async function fetchMe() {
    const p = await authApi.me()
    profile.value = p
    persist()
    return p
  }

  // 退出登录（本地清空）
  function logout() {
    token.value = ''
    refreshToken.value = ''
    profile.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { token, refreshToken, profile, register, login, fetchMe, logout }
})
