// ============================================
// 情侣空间 API
// 独立 axios 实例：不注入点餐 token，401（未解锁）不触发登录跳转
// ============================================
import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 15000,
  // 口令保存在 httpOnly cookie，跨域开发时需携带
  withCredentials: true,
})

export class CoupleApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CoupleApiError'
    this.status = status
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
    const message: string =
      error.response?.data?.message || (status === 0 ? '网络异常，请检查连接后重试' : '请求失败，请稍后重试')
    return Promise.reject(new CoupleApiError(message, status))
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

export const coupleApi = {
  session() {
    return http<CoupleSession>({ url: '/couple/session', method: 'GET' })
  },
  unlock(passcode: string) {
    return http<{ unlocked: boolean; passcodeSet: boolean; message?: string }>({
      url: '/couple/auth',
      method: 'POST',
      data: { passcode },
    })
  },
  lock() {
    return http<{ unlocked: boolean }>({ url: '/couple/lock', method: 'POST' })
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
}
