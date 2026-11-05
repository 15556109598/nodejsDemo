<script setup lang="ts">
// 今日面板：提醒 / 置顶纪念日 / 每日一句（换一句·指定） / 天气 / 今日摘要
import { computed, ref, watch } from 'vue'
import { showToast } from 'vant'
import { CoupleApiError, coupleApi, type CoupleAnniversary, type CoupleOverview, type DailyQuoteState } from '@/api/couple'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import QuoteSheet from './QuoteSheet.vue'

const props = defineProps<{
  overview: CoupleOverview
}>()

const emit = defineEmits<{
  (e: 'quote-changed'): void
  (e: 'refresh-weather'): void
  (e: 'go-tab', tab: 'today' | 'anniversary' | 'cycle' | 'daily'): void
}>()

const hero = computed<CoupleAnniversary | null>(() => {
  const list = props.overview.anniversaries
  return list.find((item) => item.pinned) || list[0] || null
})

const quoteDraft = ref('')
const addingQuote = ref(false)
const quoteError = ref('')
const quoteListOpen = ref(false)

// 每日一句：本地维护当前显示句，换一句 / 指定后立即更新，不必整页重载
const currentQuote = ref<DailyQuoteState>({ ...props.overview.quote })
const seenQuotes = new Set<string>([props.overview.quote.content])
const switching = ref(false)
const resetting = ref(false)
const quoteSheetOpen = ref(false)

watch(
  () => props.overview.quote,
  (value) => {
    currentQuote.value = { ...value }
    seenQuotes.clear()
    seenQuotes.add(value.content)
  }
)

const quoteTag = computed(() => {
  if (currentQuote.value.override) return '今天已指定'
  return currentQuote.value.isCustom ? '自定义' : '每日轮换'
})

const deletingQuoteId = ref<string | null>(null)
const confirmVisible = ref(false)
const confirmTarget = ref<{ id: string; content: string } | null>(null)

function errorMessage(error: unknown): string {
  if (error instanceof CoupleApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}

function applyQuote(quote: DailyQuoteState): void {
  currentQuote.value = { ...quote }
  seenQuotes.add(quote.content)
}

async function switchQuote(): Promise<void> {
  if (switching.value) return
  switching.value = true
  try {
    // 排除已经看过的句子：池里没有新句子时服务端返回 409，给出明确提示
    const exclude = Array.from(seenQuotes).slice(-120)
    const picked = await coupleApi.randomQuote(exclude)
    const saved = await coupleApi.setTodayQuote(picked.content)
    applyQuote(saved.quote)
  } catch (error) {
    if (error instanceof CoupleApiError && error.status === 409) {
      showToast(error.message || '句库里的句子都换过一轮了')
    } else {
      showToast(errorMessage(error))
    }
  } finally {
    switching.value = false
  }
}

async function resetQuote(): Promise<void> {
  if (resetting.value) return
  resetting.value = true
  try {
    const result = await coupleApi.resetTodayQuote()
    currentQuote.value = { ...result.quote }
    seenQuotes.clear()
    seenQuotes.add(result.quote.content)
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    resetting.value = false
  }
}

function onQuoteUpdated(quote: DailyQuoteState): void {
  applyQuote(quote)
}

async function addQuote(): Promise<void> {
  const content = quoteDraft.value.trim()
  quoteError.value = ''
  if (!content) {
    quoteError.value = '请先写一句想说的话'
    return
  }
  if (Array.from(content).length > 120) {
    quoteError.value = '最多 120 个字'
    return
  }
  addingQuote.value = true
  try {
    await coupleApi.addQuote(content)
    quoteDraft.value = ''
    showToast('已加入句子库')
    emit('quote-changed')
  } catch (error) {
    quoteError.value = errorMessage(error)
  } finally {
    addingQuote.value = false
  }
}

function askDeleteQuote(item: { id: string; content: string }): void {
  confirmTarget.value = item
  confirmVisible.value = true
}

async function deleteQuote(): Promise<void> {
  const target = confirmTarget.value
  if (!target || deletingQuoteId.value) return
  deletingQuoteId.value = target.id
  try {
    await coupleApi.removeQuote(target.id)
    showToast('已删除')
    emit('quote-changed')
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    deletingQuoteId.value = null
    confirmTarget.value = null
  }
}

function dayLabel(date: string, index: number): string {
  if (index === 0) return '今天'
  if (index === 1) return '明天'
  return date.slice(5)
}
</script>

<template>
  <div class="today">
    <!-- 提醒 -->
    <section class="card" aria-labelledby="couple-reminders-title">
      <div class="card-head">
        <h2 id="couple-reminders-title">这几天要记着</h2>
        <span class="card-tag">{{ overview.reminders.length }} 条</span>
      </div>
      <ul v-if="overview.reminders.length" class="reminder-list">
        <li v-for="item in overview.reminders" :key="item.id" class="reminder" :class="`level-${item.level}`">
          <span class="reminder-source" :class="`source-${item.kind}`">{{ item.sourceLabel }}</span>
          <div class="reminder-text">
            <p class="reminder-title">{{ item.title }}</p>
            <p class="reminder-detail">{{ item.detail }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="empty-line">这一周没有需要提醒的事。</p>
    </section>

    <!-- 置顶纪念日 -->
    <section class="hero" aria-labelledby="couple-hero-title">
      <p class="hero-eyebrow">{{ hero?.pinned ? '置顶纪念日' : '我们的日子' }}</p>
      <h2 id="couple-hero-title" class="hero-title">
        <span v-if="hero?.icon" aria-hidden="true">{{ hero.icon }}</span>
        {{ hero ? hero.title : '还没有纪念日' }}
      </h2>

      <template v-if="hero">
        <p class="hero-caption">
          {{ hero.daysSince >= 0 ? '已经一起走过' : '距离开始还有' }}
        </p>
        <p class="hero-days">
          <span class="hero-num">{{ Math.abs(hero.daysSince) }}</span>
          <span class="hero-unit">天</span>
        </p>
        <p class="hero-next">
          {{
            hero.daysUntilNext >= 0
              ? `距下一个纪念日还有 ${hero.daysUntilNext} 天`
              : `纪念日日期 ${hero.date}`
          }}
          <template v-if="hero.daysUntilNext >= 0">· {{ hero.nextDate }}</template>
        </p>
        <img
          v-if="hero.photoUrl"
          class="hero-photo"
          :src="hero.photoUrl"
          :alt="`${hero.title}的照片`"
          loading="lazy"
        />
      </template>

      <p v-else class="hero-caption">把重要的日子记下来，这里会显示天数。</p>
      <button type="button" class="btn btn-ghost" @click="emit('go-tab', 'anniversary')">
        {{ hero ? '管理纪念日' : '去添加纪念日' }}
      </button>
    </section>

    <!-- 每日一句 -->
    <section class="card" aria-labelledby="couple-quote-title">
      <div class="card-head">
        <h2 id="couple-quote-title">每日一句</h2>
        <span class="card-tag">{{ quoteTag }}</span>
      </div>
      <blockquote class="quote">
        <p>{{ currentQuote.content }}</p>
      </blockquote>
      <p class="card-note">
        同一天默认显示同一句；「换一句」和「指定」只影响今天，明天恢复每日轮换。
      </p>

      <div class="quote-actions">
        <button type="button" class="btn btn-ghost" :disabled="switching" @click="switchQuote">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h9l3 3M4 17h9l3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <path d="M17 4l3 3-3 3M17 14l3 3-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ switching ? '换一句中…' : '换一句' }}
        </button>
        <button type="button" class="btn btn-ghost" @click="quoteSheetOpen = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          指定
        </button>
      </div>
      <button
        v-if="currentQuote.override"
        type="button"
        class="link-btn reset-quote"
        :disabled="resetting"
        @click="resetQuote"
      >
        {{ resetting ? '恢复中…' : '恢复每日轮换' }}
      </button>

      <form class="quote-form" @submit.prevent="addQuote">
        <label class="sr-only" for="couple-quote-input">添加自定义句子</label>
        <input
          id="couple-quote-input"
          v-model="quoteDraft"
          class="input"
          type="text"
          maxlength="120"
          placeholder="写一句想对 TA 说的话"
          :aria-invalid="Boolean(quoteError)"
          aria-describedby="couple-quote-error"
        />
        <button type="submit" class="btn btn-primary" :disabled="addingQuote">
          {{ addingQuote ? '保存中…' : '添加' }}
        </button>
      </form>
      <p v-if="quoteError" id="couple-quote-error" class="error-text" role="alert">{{ quoteError }}</p>

      <div v-if="overview.customQuotes.length" class="quote-manage">
        <button
          type="button"
          class="link-btn"
          :aria-expanded="quoteListOpen"
          aria-controls="couple-custom-quotes"
          @click="quoteListOpen = !quoteListOpen"
        >
          {{ quoteListOpen ? '收起自定义句子' : `查看自定义句子（${overview.customQuotes.length}）` }}
        </button>
        <ul v-show="quoteListOpen" id="couple-custom-quotes" class="custom-list">
          <li v-for="item in overview.customQuotes" :key="item.id" class="custom-item">
            <span class="custom-content">{{ item.content }}</span>
            <button
              type="button"
              class="link-btn danger"
              :aria-label="`删除句子：${item.content}`"
              @click="askDeleteQuote(item)"
            >
              删除
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- 天气 -->
    <section class="card" aria-labelledby="couple-weather-title">
      <div class="card-head">
        <h2 id="couple-weather-title">天气</h2>
        <button type="button" class="link-btn" @click="emit('refresh-weather')">刷新</button>
      </div>

      <template v-if="overview.weather.available">
        <div class="weather-main">
          <span class="weather-emoji" aria-hidden="true">{{ overview.weather.emoji }}</span>
          <div>
            <p class="weather-temp">{{ overview.weather.temp ?? '—' }}<span>℃</span></p>
            <p class="weather-desc">{{ overview.weather.text }} · {{ overview.weather.city }}</p>
          </div>
        </div>
        <dl class="weather-stats">
          <div>
            <dt>最高</dt>
            <dd>{{ overview.weather.max ?? '—' }}℃</dd>
          </div>
          <div>
            <dt>最低</dt>
            <dd>{{ overview.weather.min ?? '—' }}℃</dd>
          </div>
          <div>
            <dt>降水</dt>
            <dd>{{ overview.weather.precipProb ?? '—' }}%</dd>
          </div>
        </dl>
        <div v-if="overview.weather.days.length" class="forecast">
          <div v-for="(day, index) in overview.weather.days" :key="day.date" class="forecast-day">
            <p class="forecast-label">{{ dayLabel(day.date, index) }}</p>
            <p class="forecast-emoji" aria-hidden="true">{{ day.emoji }}</p>
            <p class="forecast-temp">{{ day.max ?? '—' }}° / {{ day.min ?? '—' }}°</p>
            <p class="forecast-text">{{ day.text }}</p>
          </div>
        </div>
        <ul v-if="overview.weather.advice.length" class="advice-list">
          <li v-for="tip in overview.weather.advice" :key="tip">{{ tip }}</li>
        </ul>
      </template>

      <template v-else>
        <p class="weather-offline">
          <span aria-hidden="true">{{ overview.weather.emoji }}</span>
          {{ overview.weather.message || '天气暂时获取不到' }}
        </p>
        <p class="card-note">天气失败不影响其他内容，稍后可以点「刷新」再试。</p>
      </template>
    </section>

    <!-- 今日摘要 -->
    <section class="card" aria-labelledby="couple-summary-title">
      <div class="card-head">
        <h2 id="couple-summary-title">今日摘要</h2>
        <span class="card-tag">{{ overview.today }}</span>
      </div>
      <ul class="summary-list">
        <li v-for="line in overview.summary.lines" :key="line">{{ line }}</li>
      </ul>
      <p class="card-note">每日推送为可选项，未配置飞书机器人时不会发送。</p>
    </section>

    <QuoteSheet v-model:show="quoteSheetOpen" :current="currentQuote" @updated="onQuoteUpdated" />

    <ConfirmDialog
      v-model:show="confirmVisible"
      title="删除这句？"
      :message="confirmTarget ? `确定删除「${confirmTarget.content}」吗？删除后不再参与轮换。` : ''"
      confirm-text="删除"
      danger
      @confirm="deleteQuote"
    />
  </div>
</template>

<style scoped lang="scss">
.today {
  display: flex;
  flex-direction: column;
  gap: 12PX;
}

.card,
.hero {
  padding: 18PX 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8PX;
  margin-bottom: 10PX;

  h2 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }
}

.card-tag {
  flex: none;
  padding: 1PX 8PX;
  font-size: 12PX;
  line-height: 18PX;
  color: $ink-muted;
  background: $line-soft;
  border-radius: 8PX;
}

.card-note {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.empty-line {
  font-size: 14PX;
  line-height: 1.5;
  color: $ink-muted;
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8PX;
}

.reminder {
  display: flex;
  gap: 10PX;
  padding: 10PX 12PX;
  background: $line-soft;
  border-radius: 12PX;

  &.level-warn {
    background: $warning-tint;
  }
}

.reminder-source {
  flex: none;
  align-self: flex-start;
  padding: 2PX 8PX;
  font-size: 12PX;
  line-height: 18PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 6PX;
  white-space: nowrap;
}

.reminder-text {
  min-width: 0;
}

.reminder-title {
  font-size: 14PX;
  font-weight: 500;
  line-height: 1.5;
  color: $ink;
  overflow-wrap: anywhere;
}

.reminder-detail {
  margin-top: 2PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.hero {
  text-align: center;
  background: $surface;
  border-radius: 20PX;
  border-color: $line;
}

.hero-eyebrow {
  font-size: 12PX;
  letter-spacing: 0.4PX;
  color: $ink-muted;
}

.hero-title {
  margin-top: 8PX;
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.25;
  color: $ink;
  overflow-wrap: anywhere;
}

.hero-days {
  margin-top: 10PX;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4PX;
  color: $brand-action;
}

.hero-num {
  font-size: 22PX;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.4PX;
  font-variant-numeric: tabular-nums;
}

.hero-unit {
  font-size: 14PX;
}

.hero-caption {
  margin-top: 4PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.hero-next {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
  overflow-wrap: anywhere;
}

.hero-photo {
  width: 100%;
  max-height: 200PX;
  margin-top: 12PX;
  object-fit: cover;
  border-radius: 12PX;
  border: 1PX solid $line;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6PX;
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;
  transition: background $motion-fast $ease-standard;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.quote-actions {
  display: flex;
  gap: 8PX;
  margin-top: 12PX;

  .btn-ghost {
    flex: 1;
    width: auto;
    margin-top: 0;
  }
}

.reset-quote {
  display: inline-flex;
  align-items: center;
  margin-top: 4PX;
}

.btn-ghost {
  width: 100%;
  margin-top: 14PX;
  color: $ink-secondary;
  background: $surface;

  &:active {
    background: $bg-warm;
  }
}

.btn-primary {
  flex: none;
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;

  &:active {
    background: $brand-action-dark;
  }
}

.quote {
  padding: 14PX 16PX;
  background: $brand-tint;
  border-radius: 12PX;

  p {
    font-size: 18PX;
    font-weight: 500;
    line-height: 1.5;
    color: $ink;
    overflow-wrap: anywhere;
  }
}

.quote-form {
  display: flex;
  gap: 8PX;
  margin-top: 12PX;
}

.input {
  flex: 1;
  min-width: 0;
  min-height: 44PX;
  padding: 10PX 12PX;
  font-size: 14PX;
  color: $ink;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;

  &::placeholder {
    color: $placeholder;
  }

  &[aria-invalid='true'] {
    border-color: $danger-text;
  }
}

.error-text {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $danger-text;
}

.quote-manage {
  margin-top: 10PX;
}

.link-btn {
  min-height: 44PX;
  min-width: 44PX;
  padding: 0 8PX;
  font-size: 13PX;
  color: $brand-action;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: center;

  &.danger {
    color: $danger-text;
  }
}

.custom-list {
  margin-top: 4PX;
  display: flex;
  flex-direction: column;
}

.custom-item {
  display: flex;
  align-items: center;
  gap: 8PX;
  padding: 6PX 0;
  border-top: 1PX solid $line-soft;
}

.custom-content {
  flex: 1;
  min-width: 0;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
  overflow-wrap: anywhere;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 12PX;
}

.weather-emoji {
  font-size: 28PX;
  line-height: 1;
}

.weather-temp {
  font-size: 22PX;
  font-weight: 700;
  line-height: 1.15;
  color: $ink;
  font-variant-numeric: tabular-nums;

  span {
    margin-left: 2PX;
    font-size: 14PX;
    font-weight: 400;
    color: $ink-secondary;
  }
}

.weather-desc {
  margin-top: 2PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.weather-stats {
  display: flex;
  gap: 8PX;
  margin-top: 12PX;

  div {
    flex: 1;
    padding: 8PX 10PX;
    background: $line-soft;
    border-radius: 12PX;
  }

  dt {
    font-size: 12PX;
    line-height: 1.5;
    color: $ink-muted;
  }

  dd {
    font-size: 14PX;
    font-weight: 500;
    line-height: 1.5;
    color: $ink;
  }
}

.forecast {
  display: flex;
  gap: 8PX;
  margin-top: 10PX;
}

.forecast-day {
  flex: 1;
  min-width: 0;
  padding: 8PX 6PX;
  text-align: center;
  background: $bg-warm;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.forecast-label {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.forecast-emoji {
  font-size: 18PX;
  line-height: 1.4;
}

.forecast-temp {
  font-size: 13PX;
  font-weight: 500;
  line-height: 1.5;
  color: $ink;
}

.forecast-text {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.advice-list {
  margin-top: 10PX;
  display: flex;
  flex-direction: column;
  gap: 4PX;

  li {
    position: relative;
    padding-left: 14PX;
    font-size: 13PX;
    line-height: 1.5;
    color: $ink-secondary;
    overflow-wrap: anywhere;

    &::before {
      content: '';
      position: absolute;
      left: 2PX;
      top: 8PX;
      width: 4PX;
      height: 4PX;
      border-radius: 50%;
      background: $brand-action;
    }
  }
}

.weather-offline {
  display: flex;
  align-items: center;
  gap: 8PX;
  font-size: 14PX;
  line-height: 1.5;
  color: $ink-secondary;
  overflow-wrap: anywhere;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 6PX;

  li {
    position: relative;
    padding-left: 14PX;
    font-size: 13PX;
    line-height: 1.5;
    color: $ink-secondary;
    overflow-wrap: anywhere;

    &::before {
      content: '';
      position: absolute;
      left: 2PX;
      top: 8PX;
      width: 4PX;
      height: 4PX;
      border-radius: 50%;
      background: $ink-muted;
    }
  }
}

.sr-only {
  position: absolute;
  width: 1PX;
  height: 1PX;
  padding: 0;
  margin: -1PX;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (min-width: 768px) {
  .hero-num {
    font-size: 22PX;
  }
}
</style>
