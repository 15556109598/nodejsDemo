// ============================================
// 情侣空间 API
// 独立 axios 实例：不注入点餐 token，401（未解锁）不触发登录跳转
// ============================================
import axios from 'axios'

// ============================================
// 本地凭证（Cookie 的补充路径）
// 移动端浏览器可能不保存 HttpOnly Cookie（Safari「阻止所有 Cookie」、微信内置浏览器、无痕模式）。
// /auth 会额外返回一个 HMAC 签名 token，这里存 localStorage 并用 Authorization 携带。
// 注意：localStorage 在 XSS 下可被读取，风险高于 HttpOnly Cookie；仅在 Cookie 失效时作为兜底。
// ============================================
const TOKEN_KEY = 'couple.localToken'
// 内存副本：即使 localStorage 被禁用（部分隐私模式），当前会话也能继续使用
let memoryToken = ''

function readLocalToken(): string {
  if (memoryToken) return memoryToken
  try {
    return window.localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function saveLocalToken(token: string): void {
  if (!token) return
  memoryToken = token
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 隐私模式可能禁用 localStorage：保留内存副本，当前会话仍可用
  }
}

export function clearLocalToken(): void {
  memoryToken = ''
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 忽略
  }
}

export function hasLocalToken(): boolean {
  return Boolean(readLocalToken())
}

// ============================================
// 设备链接凭证（手机桌面 / iOS 独立 Web App 兜底）
// 链接形如 /couple?device=<token>，不依赖 cookie 与 localStorage；
// 从桌面图标打开时地址栏仍带该参数，因此每次启动都能直接进入。
// 风险：链接等同于钥匙，不要外发；可在设置页吊销。
// ============================================
const DEVICE_KEY = 'couple.device'
let activeDevice = ''

function captureDevice(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('device') || ''
    if (fromUrl) {
      activeDevice = fromUrl
      try {
        window.localStorage.setItem(DEVICE_KEY, fromUrl)
      } catch {
        // 存储不可用时仅保留内存副本（本次启动仍有效）
      }
      return fromUrl
    }
    const saved = window.localStorage.getItem(DEVICE_KEY) || ''
    activeDevice = saved
    return saved
  } catch {
    return activeDevice
  }
}

export function currentDeviceToken(): string {
  return activeDevice || captureDevice()
}

export function hasDeviceToken(): boolean {
  return Boolean(currentDeviceToken())
}

captureDevice()

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  // Render 免费实例首次请求可能要 30-60 秒唤醒，这里放宽到 60 秒
  timeout: 60000,
  // 口令保存在 httpOnly cookie，跨域开发时需携带
  withCredentials: true,
})

// 每次请求自带本地凭证（若存在）；Cookie 有效时服务端优先用 Cookie
client.interceptors.request.use((config) => {
  const token = readLocalToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  const device = currentDeviceToken()
  if (device) config.headers.set('x-couple-device', device)
  return config
})

export class CoupleApiError extends Error {
  status: number
  retryAfter: number

  constructor(message: string, status: number, retryAfter = 0) {
    super(message)
    this.name = 'CoupleApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

client.interceptors.response.use(
  (response) => {
    const body = response.data
    if (!body || body.code !== 0) {
      return Promise.reject(new CoupleApiError(body?.message || '请求失败', response.status))
    }
    return body.data
  },
  (error) => {
    const status: number = error.response?.status ?? 0
    const retryAfter = Number(error.response?.headers?.['retry-after']) || 0
    let message: string = error.response?.data?.message || '请求失败，请稍后重试'
    if (status === 0) message = '网络异常或服务正在唤醒，请稍等 30 秒后重试'
    // 401 说明本地凭证也失效了（过期或服务端口令已变更），清掉避免每次请求都带坏 token
    if (status === 401) clearLocalToken()
    return Promise.reject(new CoupleApiError(message, status, retryAfter))
  }
)

function http<T>(config: Parameters<typeof client.request>[0]): Promise<T> {
  return client.request<T, T>(config)
}

export interface CoupleSession {
  passcodeSet: boolean
  unlocked: boolean
}

export interface CoupleSettings {
  city: string
  latitude: number
  longitude: number
  nearAnniversaryDays: number
  cycleAheadDays: number
  cycleDelayDays: number
  weatherDeltaC: number
}

export interface CoupleAnniversary {
  id: string
  title: string
  // YYYY-MM-DD
  date: string
  yearly: boolean
  icon: string
  photoUrl: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  // 由服务端计算
  daysSince: number
  daysUntilNext: number
  nextDate: string
}

export interface AnniversaryPayload {
  title: string
  date: string
  yearly: boolean
  icon: string
  photoUrl: string
  pinned: boolean
}

export interface CycleRecord {
  id: string
  startDate: string
  endDate: string | null
  note: string
  createdAt: string
  updatedAt: string
}

export interface CyclePayload {
  startDate: string
  endDate: string | null
  note: string
}

export interface CycleStats {
  recordCount: number
  intervalCount: number
  averageCycle: number | null
  averagePeriod: number | null
  minCycle: number | null
  maxCycle: number | null
  sampleEnough: boolean
  trend: { startDate: string; length: number }[]
}

export interface CyclePrediction {
  status: 'none' | 'insufficient' | 'period' | 'upcoming' | 'normal' | 'overdue'
  statusText: string
  currentDay: number | null
  nextStart: string | null
  daysUntilNext: number | null
  overdueDays: number | null
}

export interface WeatherDay {
  date: string
  max: number | null
  min: number | null
  precipProb: number | null
  code: number | null
  text: string
  emoji: string
}

export interface WeatherInfo {
  available: boolean
  city: string
  temp: number | null
  code: number | null
  text: string
  emoji: string
  max: number | null
  min: number | null
  precipProb: number | null
  days: WeatherDay[]
  advice: string[]
  updatedAt: string
  message?: string
}

export interface Reminder {
  id: string
  kind: 'anniversary' | 'cycle' | 'weather'
  level: 'info' | 'warn'
  title: string
  detail: string
}

export interface CoupleQuote {
  id: string
  content: string
  isCustom: boolean
  createdAt: string
}

export interface DailySummary {
  date: string
  lines: string[]
  text: string
}

export interface CoupleOverview {
  today: string
  passcodeSet: boolean
  settings: CoupleSettings
  anniversaries: CoupleAnniversary[]
  quote: { content: string; isCustom: boolean; index: number }
  weather: WeatherInfo
  cycle: {
    records: CycleRecord[]
    stats: CycleStats
    prediction: CyclePrediction
  }
  reminders: Reminder[]
  summary: DailySummary
  customQuotes: CoupleQuote[]
}

export interface CoupleDevice {
  id: string
  label: string
  createdAt: string
}

export const coupleApi = {
  session() {
    return http<CoupleSession>({ url: '/couple/session', method: 'GET' })
  },
  unlock(passcode: string) {
    return http<{ unlocked: boolean; passcodeSet: boolean; token?: string | null; message?: string }>({
      url: '/couple/auth',
      method: 'POST',
      data: { passcode },
    }).then((data) => {
      // Cookie 若被浏览器拒绝保存，token 就是后续请求的唯一凭证
      if (data.token) saveLocalToken(data.token)
      return data
    })
  },
  lock() {
    return http<{ unlocked: boolean }>({ url: '/couple/lock', method: 'POST' }).then((data) => {
      clearLocalToken()
      return data
    })
  },
  overview() {
    return http<CoupleOverview>({ url: '/couple/overview', method: 'GET' })
  },
  weather() {
    return http<WeatherInfo>({ url: '/couple/weather', method: 'GET' })
  },
  createAnniversary(data: AnniversaryPayload) {
    return http<CoupleAnniversary>({ url: '/couple/anniversaries', method: 'POST', data })
  },
  updateAnniversary(id: string, data: AnniversaryPayload) {
    return http<CoupleAnniversary>({ url: `/couple/anniversaries/${id}`, method: 'PUT', data })
  },
  removeAnniversary(id: string) {
    return http<{ id: string }>({ url: `/couple/anniversaries/${id}`, method: 'DELETE' })
  },
  createCycle(data: CyclePayload) {
    return http<CycleRecord>({ url: '/couple/cycles', method: 'POST', data })
  },
  updateCycle(id: string, data: CyclePayload) {
    return http<CycleRecord>({ url: `/couple/cycles/${id}`, method: 'PUT', data })
  },
  removeCycle(id: string) {
    return http<{ id: string }>({ url: `/couple/cycles/${id}`, method: 'DELETE' })
  },
  addQuote(content: string) {
    return http<CoupleQuote>({ url: '/couple/quotes', method: 'POST', data: { content } })
  },
  removeQuote(id: string) {
    return http<{ id: string }>({ url: `/couple/quotes/${id}`, method: 'DELETE' })
  },
  saveSettings(data: Partial<CoupleSettings>) {
    return http<CoupleSettings>({ url: '/couple/settings', method: 'PUT', data })
  },
  createDeviceLink(label: string) {
    return http<{ device: CoupleDevice; url: string }>({
      url: '/couple/device-link',
      method: 'POST',
      data: { label },
    })
  },
  listDevices() {
    return http<CoupleDevice[]>({ url: '/couple/devices', method: 'GET' })
  },
  revokeDevice(id: string) {
    return http<{ id: string }>({ url: `/couple/devices/${id}`, method: 'DELETE' })
  },
}
