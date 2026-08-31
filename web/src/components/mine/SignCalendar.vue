<script setup lang="ts">
// 签到日历：月份切换（含滑动）+ 签到 + 彩带动效 + 统计
import { ref, computed, watch, onMounted } from 'vue'
import { showToast } from 'vant'
import confetti from 'canvas-confetti'
import { signinApi } from '@/api'
import type { SignInfo } from '@/api/types'
import { monthCells, fmtDate, type CalendarCell } from '@/utils/format'
import { countUp } from '@/utils/countUp'

const emit = defineEmits<{
  (e: 'signed'): void
}>()

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1) // 1~12

const info = ref<SignInfo | null>(null)

const today = fmtDate(new Date())
const cells = computed(() => monthCells(year.value, month.value))
const signedSet = computed(() => new Set((info.value?.dates || []).map((d) => d.date)))
const todaySigned = computed(() => signedSet.value.has(today))

async function load() {
  try {
    info.value = await signinApi.info({ year: year.value, month: month.value })
  } catch {
    // 错误已在拦截器统一提示
  }
}

watch([year, month], load)
onMounted(load)

// 月份切换
function prevMonth() {
  let y = year.value
  let m = month.value - 1
  if (m < 1) {
    m = 12
    y -= 1
  }
  year.value = y
  month.value = m
}

function nextMonth() {
  let y = year.value
  let m = month.value + 1
  if (m > 12) {
    m = 1
    y += 1
  }
  year.value = y
  month.value = m
}

// 触摸滑动切月
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) nextMonth()
    else prevMonth()
  }
}

// 统计数字滚动
const totalEl = ref<HTMLElement | null>(null)
const streakEl = ref<HTMLElement | null>(null)
let prevTotal = 0
let prevStreak = 0

watch(info, (v) => {
  const t = v?.totalSigned ?? 0
  const s = v?.streak ?? 0
  if (totalEl.value) countUp(totalEl.value, prevTotal, t)
  if (streakEl.value) countUp(streakEl.value, prevStreak, s)
  prevTotal = t
  prevStreak = s
})

// 立即签到
const signing = ref(false)

async function sign() {
  if (todaySigned.value || signing.value) return
  signing.value = true
  try {
    const res = await signinApi.sign()
    // canvas-confetti 两连发（左右各一发，橙色系粒子）
    const colors = ['#FF6B35', '#FF8F5E', '#FFC107', '#FFE0B2', '#ffffff']
    confetti({ particleCount: 90, spread: 75, angle: 60, origin: { x: 0.15, y: 0.7 }, colors })
    window.setTimeout(() => {
      confetti({ particleCount: 90, spread: 75, angle: 120, origin: { x: 0.85, y: 0.7 }, colors })
    }, 150)
    showToast(`+${res.pointsGained} 积分`)
    await load()
    emit('signed')
  } catch {
    // 错误已在拦截器统一提示
  } finally {
    signing.value = false
  }
}

// 单元格样式判断
function isSignedCell(c: CalendarCell) {
  return c.inMonth && signedSet.value.has(fmtDate(c.date))
}

function isTodayCell(c: CalendarCell) {
  return fmtDate(c.date) === today
}

function isGrayCell(c: CalendarCell) {
  return !c.inMonth || c.isFuture
}
</script>

<template>
  <div class="sign-calendar card">
    <!-- 月份切换 -->
    <div class="month-row">
      <van-icon class="arrow press" name="arrow-left" size="18" @click="prevMonth" />
      <span class="month-text">{{ year }}年{{ month }}月</span>
      <van-icon class="arrow press" name="arrow" size="18" @click="nextMonth" />
    </div>

    <!-- 星期标题 -->
    <div class="week-row">
      <span v-for="w in WEEK" :key="w" class="week-item hint-text">{{ w }}</span>
    </div>

    <!-- 日期网格（支持左右滑动切月） -->
    <div class="cal-grid" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <div v-for="c in cells" :key="c.key" class="cell">
        <div
          class="day"
          :class="{
            signed: isSignedCell(c),
            today: isTodayCell(c) && !todaySigned,
            gray: isGrayCell(c) && !isSignedCell(c),
          }"
        >
          {{ c.day }}
          <span v-if="isSignedCell(c)" class="check">✓</span>
        </div>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stat-row">
      <span class="hint-text">
        已签到 <b ref="totalEl" class="stat-num">0</b> 天
      </span>
      <span class="divider">·</span>
      <span class="hint-text">
        连续 <b ref="streakEl" class="stat-num">0</b> 天
      </span>
    </div>

    <!-- 签到按钮 -->
    <button class="sign-btn press" :disabled="todaySigned || signing" @click="sign">
      {{ todaySigned ? '今日已签到 ✓' : signing ? '签到中...' : '立即签到' }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.sign-calendar {
  padding: 16px;
}

.month-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 10px;

  .month-text {
    font-size: $font-md;
    font-weight: $font-bold;
  }

  .arrow {
    padding: 4px;
    color: $text-secondary;
  }
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;

  .week-item {
    text-align: center;
  }
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 4px;
  touch-action: pan-y;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.day {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-sm;
  color: $text-primary;
  transition: all 150ms ease;

  // 已签到：橙色渐变圆底白字 + 右上角小✓
  &.signed {
    background: $primary-gradient;
    color: #fff;
    font-weight: $font-medium;

    .check {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: $success;
      color: #fff;
      font-size: 8px;
      line-height: 12px;
      text-align: center;
    }
  }

  // 今天未签：橙色渐变圆环 + 光晕脉动
  &.today {
    color: $primary;
    font-weight: $font-bold;
    box-shadow: inset 0 0 0 2px $primary;
    animation: pulse 2s ease-in-out infinite;
  }

  // 非本月 / 未来：淡灰
  &.gray {
    color: #d4d6da;
  }
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed $border;

  .stat-num {
    color: $primary;
    font-size: $font-md;
  }

  .divider {
    color: $text-hint;
  }
}

.sign-btn {
  width: 100%;
  height: 44px;
  margin-top: 14px;
  border: none;
  border-radius: $radius-full;
  background: $primary-gradient;
  color: #fff;
  font-size: 16px;
  font-weight: $font-medium;

  &:disabled {
    background: #e5e6eb;
    color: #fff;
  }
}
</style>
