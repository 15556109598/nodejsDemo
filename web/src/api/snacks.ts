// ============================================
// 零食日期管理 API（无需登录，服务端共享数据）
// ============================================
import { http } from './request'

export interface SnackItem {
  id: string
  name: string
  brand: string
  quantity: number
  // YYYY-MM-DD
  expireDate: string
  note: string
  photoUrl: string
  finished: boolean
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SnackSettings {
  nearDays: number
}

export interface SnackListResult {
  items: SnackItem[]
  settings: SnackSettings
}

export interface SnackPayload {
  name: string
  brand: string
  quantity: number
  expireDate: string
  note: string
  photoUrl: string
}

// 上传图片：直接发送原始二进制，服务端校验 MIME 白名单 + 文件头 + 大小上限
export function uploadSnackPhoto(file: Blob): Promise<{ url: string }> {
  return http<{ url: string }>({
    url: '/snacks/photo',
    method: 'POST',
    data: file,
    headers: { 'Content-Type': file.type },
    timeout: 30000,
  })
}

// 图片相对地址（/uploads/...）在跨域部署时需拼上 API 域名
export function resolveUploadUrl(url: string): string {
  if (!url) return ''
  if (/^(https?:|blob:|data:)/.test(url)) return url
  const base = (import.meta.env.VITE_API_BASE as string) || '/api'
  if (/^http/i.test(base)) {
    return new URL(url, base).toString()
  }
  return url
}

export const snackApi = {
  list() {
    return http<SnackListResult>({ url: '/snacks', params: { t: Date.now() } })
  },
  create(data: SnackPayload) {
    return http<SnackItem>({ url: '/snacks', method: 'POST', data })
  },
  update(id: string, data: SnackPayload) {
    return http<SnackItem>({ url: `/snacks/${id}`, method: 'PUT', data })
  },
  remove(id: string) {
    return http<{ id: string }>({ url: `/snacks/${id}`, method: 'DELETE' })
  },
  finish(id: string, finished = true) {
    return http<SnackItem>({ url: `/snacks/${id}/finish`, method: 'POST', data: { finished } })
  },
  updateSettings(nearDays: number) {
    return http<SnackSettings>({ url: '/snacks/settings', method: 'PUT', data: { nearDays } })
  },
}
