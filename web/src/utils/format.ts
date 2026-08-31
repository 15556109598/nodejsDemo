// 格式化工具

// 价格 → 'xx.xx'
export function formatPrice(n: number | string): string {
  const num = Number(n) || 0
  return num.toFixed(2)
}

// 销量 → '已售xx'
export function formatSales(n: number): string {
  return `已售${n}`
}

// 辣度 → 🌶️ 重复
export function formatSpiciness(level: number): string {
  if (!level) return ''
  return '🌶️'.repeat(Math.min(level, 3))
}

// 本地时区日期 → 'YYYY-MM-DD'
export function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 生成某年某月日历的 6 行 x 7 列（周日起始）单元格
// 返回 { date, day, inMonth, isFuture, key }
export interface CalendarCell {
  date: Date
  day: number
  inMonth: boolean
  isFuture: boolean
  key: string
}

export function monthCells(year: number, month: number): CalendarCell[] {
  // month: 1~12
  const firstDay = new Date(year, month - 1, 1)
  // 本月 1 号是周几（0=周日）
  const startWeek = firstDay.getDay()
  const cells: CalendarCell[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 从月初所在周的周日开始，铺满 42 格
  const start = new Date(year, month - 1, 1 - startWeek)
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      date: d,
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
      isFuture: d.getTime() > today.getTime(),
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
    })
  }
  return cells
}

// 时间显示：'MM-DD HH:mm'
export function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
