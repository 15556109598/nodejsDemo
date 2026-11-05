<script setup lang="ts">
// 情侣空间：口令门 + 今日 / 纪念日 / 经期 三个分段 + 设置
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { CoupleApiError, clearLocalToken, coupleApi, type CoupleOverview, type CoupleSession } from '@/api/couple'
import TodayPanel from './components/TodayPanel.vue'
import AnniversaryPanel from './components/AnniversaryPanel.vue'
import CyclePanel from './components/CyclePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const router = useRouter()

type TabKey = 'today' | 'anniversary' | 'cycle'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'anniversary', label: '纪念日' },
  { key: 'cycle', label: '经期' },
]

const loading = ref(true)
const loadError = ref('')
const overview = ref<CoupleOverview | null>(null)
const passcodeSet = ref(true)
const locked = ref(false)
const tab = ref<TabKey>('today')
const settingsOpen = ref(false)

const passcode = ref('')
const unlocking = ref(false)
const unlockError = ref('')
// 429 冷却剩余秒数：由服务端 Retry-After 驱动，倒计时结束后按钮恢复可用
const cooldownLeft = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds))
  if (s < 60) return `${s} 秒`
  const minutes = Math.floor(s / 60)
  const rest = s % 60
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`
}

function stopCooldown(): void {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldown(seconds: number): void {
  stopCooldown()
  cooldownLeft.value = Math.max(1, Math.ceil(seconds))
  cooldownTimer = setInterval(() => {
    cooldownLeft.value -= 1
    if (cooldownLeft.value <= 0) {
      cooldownLeft.value = 0
      stopCooldown()
    }
  }, 1000)
}

const gateErrorText = computed(() =>
  cooldownLeft.value > 0
    ? `尝试次数过多，请等待 ${formatWait(cooldownLeft.value)}后再试`
    : unlockError.value
)

const titleRef = ref<HTMLElement | null>(null)

const activeTab = computed(() => TABS.find((t) => t.key === tab.value) || TABS[0])

function errorMessage(error: unknown): string {
  if (error instanceof CoupleApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}

async function loadOverview(silent = false): Promise<boolean> {
  if (!silent) {
    loading.value = true
    loadError.value = ''
  }
  try {
    overview.value = await coupleApi.overview()
    passcodeSet.value = overview.value.passcodeSet
    locked.value = false
    loadError.value = ''
    return true
  } catch (error) {
    const status = error instanceof CoupleApiError ? error.status : 0
    if (status === 401) {
      locked.value = true
      overview.value = null
    } else {
      loadError.value = errorMessage(error)
      // 静默刷新失败时不整页替换内容，用轻提示告知
      if (silent && overview.value) showToast(loadError.value)
    }
    return false
  } finally {
    loading.value = false
  }
}

async function init(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const session: CoupleSession = await coupleApi.session()
    passcodeSet.value = session.passcodeSet
    if (session.passcodeSet && !session.unlocked) {
      locked.value = true
      overview.value = null
      loading.value = false
      await nextTick()
      document.getElementById('couple-passcode')?.focus()
      return
    }
    locked.value = false
    await loadOverview()
  } catch (error) {
    loadError.value = errorMessage(error)
    loading.value = false
  } finally {
    if (loading.value) loading.value = false
  }
}

async function unlock(): Promise<void> {
  if (unlocking.value || cooldownLeft.value > 0) return
  unlockError.value = ''
  if (!passcode.value.trim()) {
    unlockError.value = '请输入口令'
    return
  }
  unlocking.value = true
  try {
    await coupleApi.unlock(passcode.value.trim())
    stopCooldown()
    cooldownLeft.value = 0
    locked.value = false
    // 口令正确后原地拉取数据，不做整页刷新（避免移动端刷新丢失凭证）
    const loaded = await loadOverview()
    if (loaded) {
      passcode.value = ''
      await nextTick()
      titleRef.value?.focus()
    } else {
      // /auth 已返回 200 但随后请求 401：浏览器没有保存 Cookie，本地凭证也未生效
      unlockError.value =
        '登录成功，但浏览器未保存登录状态：请允许本站 Cookie（关闭“阻止所有 Cookie”与无痕模式）后重试'
    }
  } catch (error) {
    unlockError.value = errorMessage(error)
    if (error instanceof CoupleApiError && error.status === 429) {
      startCooldown(error.retryAfter > 0 ? error.retryAfter : 300)
    }
  } finally {
    unlocking.value = false
  }
}

async function lock(): Promise<void> {
  try {
    await coupleApi.lock()
    locked.value = true
    overview.value = null
    settingsOpen.value = false
    stopCooldown()
    cooldownLeft.value = 0
    unlockError.value = ''
    showToast('已锁定')
    await nextTick()
    document.getElementById('couple-passcode')?.focus()
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    // 即使服务端请求失败，也要清掉本地凭证，避免「锁定」后刷新又自动登录
    clearLocalToken()
  }
}

async function onQuoteChanged(): Promise<void> {
  await loadOverview(true)
}

async function onSettingsSaved(): Promise<void> {
  await loadOverview(true)
}

async function refreshWeather(): Promise<void> {
  try {
    const weather = await coupleApi.weather()
    if (overview.value) overview.value = { ...overview.value, weather }
    showToast(weather.available ? '天气已更新' : '天气暂不可用')
  } catch (error) {
    showToast(errorMessage(error))
  }
}

// 分段导航键盘操作：左右方向键切换
function onTabKeydown(event: KeyboardEvent, index: number): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const delta = event.key === 'ArrowRight' ? 1 : -1
  const next = (index + delta + TABS.length) % TABS.length
  tab.value = TABS[next].key
  nextTick(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.tab-button')
    buttons[next]?.focus()
  })
}

function goTab(key: TabKey): void {
  tab.value = key
}

onMounted(init)
onUnmounted(stopCooldown)
</script>

<template>
  <div class="couple">
    <header class="page-head">
      <button type="button" class="icon-btn" aria-label="返回应用中心" @click="router.push('/')">
        <van-icon name="arrow-left" aria-hidden="true" />
      </button>
      <div class="head-text">
        <h1 ref="titleRef" tabindex="-1">我们的空间</h1>
        <p>纪念日、每日一句、天气与身体记录</p>
      </div>
      <button
        type="button"
        class="icon-btn"
        :aria-label="settingsOpen ? '收起设置' : '打开设置'"
        :aria-expanded="settingsOpen"
        aria-controls="couple-settings"
        @click="settingsOpen = !settingsOpen"
      >
        <van-icon name="setting-o" aria-hidden="true" />
      </button>
    </header>

    <main class="page-body">
      <div v-if="loadError && !overview" class="state-card state-error" role="alert">
        <h2>页面加载失败</h2>
        <p>{{ loadError }}</p>
        <button type="button" class="btn btn-primary" @click="init">重新加载</button>
      </div>

      <div v-else-if="loading" class="state-card" aria-busy="true" aria-live="polite">
        <div class="skeleton skeleton-line" />
        <div class="skeleton skeleton-block" />
        <div class="skeleton skeleton-line short" />
        <p class="loading-text">正在加载今天的数据…</p>
        <p class="loading-hint">首次访问可能需要等待服务唤醒，约 30 秒</p>
      </div>

      <section v-else-if="locked" class="gate" aria-labelledby="couple-gate-title">
        <h2 id="couple-gate-title" class="gate-title">需要口令</h2>
        <p class="gate-desc">这里存放两个人的私密记录，输入口令后解锁。</p>
        <form class="gate-form" @submit.prevent="unlock">
          <label class="field-label" for="couple-passcode">访问口令</label>
          <input
            id="couple-passcode"
            v-model="passcode"
            class="field-input"
            type="password"
            inputmode="text"
            autocomplete="current-password"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="go"
            placeholder="请输入口令"
            :aria-invalid="Boolean(gateErrorText)"
            aria-describedby="couple-passcode-error"
          />
          <p v-if="gateErrorText" id="couple-passcode-error" class="field-error" role="alert">{{ gateErrorText }}</p>
          <button
            type="submit"
            class="btn btn-primary btn-block"
            :disabled="unlocking || cooldownLeft > 0"
          >
            {{ unlocking ? '验证中…' : cooldownLeft > 0 ? '请稍后再试' : '解锁' }}
          </button>
        </form>
        <p class="gate-note">
          口令不正确会被拒绝；登录状态优先写入 Cookie，若浏览器不允许 Cookie 会改用本地凭证（不保存口令明文）。
        </p>
      </section>

      <template v-else-if="overview">
        <div v-if="!passcodeSet" class="warn-banner" role="status">
          <span class="warn-icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>未设置口令，当前内容公开可见</strong>
            <p>在部署环境配置 <code>COUPLE_PASSCODE</code> 后，本页会自动要求口令。</p>
          </div>
        </div>

        <SettingsPanel
          v-show="settingsOpen"
          id="couple-settings"
          :settings="overview.settings"
          :passcode-set="passcodeSet"
          @saved="onSettingsSaved"
          @lock="lock"
          @close="settingsOpen = false"
        />

        <div class="tabs" role="tablist" aria-label="情侣空间分区">
          <button
            v-for="(item, index) in TABS"
            :key="item.key"
            type="button"
            class="tab-button"
            :class="{ active: tab === item.key }"
            role="tab"
            :aria-selected="tab === item.key"
            :aria-controls="`couple-panel-${item.key}`"
            :id="`couple-tab-${item.key}`"
            :tabindex="tab === item.key ? 0 : -1"
            @click="tab = item.key"
            @keydown="onTabKeydown($event, index)"
          >
            {{ item.label }}
          </button>
        </div>

        <section
          v-show="tab === 'today'"
          id="couple-panel-today"
          role="tabpanel"
          aria-labelledby="couple-tab-today"
          class="panel"
        >
          <TodayPanel
            :overview="overview"
            @quote-changed="onQuoteChanged"
            @refresh-weather="refreshWeather"
            @go-tab="goTab"
          />
        </section>

        <section
          v-show="tab === 'anniversary'"
          id="couple-panel-anniversary"
          role="tabpanel"
          aria-labelledby="couple-tab-anniversary"
          class="panel"
        >
          <AnniversaryPanel :items="overview.anniversaries" @changed="onQuoteChanged" />
        </section>

        <section
          v-show="tab === 'cycle'"
          id="couple-panel-cycle"
          role="tabpanel"
          aria-labelledby="couple-tab-cycle"
          class="panel"
        >
          <CyclePanel
            :records="overview.cycle.records"
            :stats="overview.cycle.stats"
            :prediction="overview.cycle.prediction"
            :today="overview.today"
            @changed="onQuoteChanged"
          />
        </section>

        <p class="page-foot">数据仅保存在你的 Supabase 中 · {{ activeTab.label }} · 更新于 {{ overview.today }}</p>
      </template>
    </main>
  </div>
</template>

<style scoped lang="scss">
// 与入口页/零食页一致：大写 PX 不参与 px→vw 转换，桌面 760PX 居中
.couple {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: $bg-warm;
  color: $ink;
}

.page-head,
.page-body {
  width: 100%;
  max-width: 480PX;
}

.page-head {
  display: flex;
  align-items: center;
  gap: 8PX;
  padding: calc(12PX + env(safe-area-inset-top)) 12PX 12PX;
  border-bottom: 1PX solid $line;
}

.head-text {
  flex: 1;
  min-width: 0;
  text-align: center;

  h1 {
    font-size: 18PX;
    font-weight: 700;
    line-height: 1.25;
    color: $ink;

    &:focus-visible {
      outline-offset: 4PX;
      border-radius: 4PX;
    }
  }

  p {
    margin-top: 2PX;
    font-size: 12PX;
    line-height: 1.5;
    color: $ink-muted;
  }
}

.icon-btn {
  flex: none;
  width: 44PX;
  height: 44PX;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;
}

.page-body {
  flex: 1;
  padding: 16PX 16PX calc(32PX + env(safe-area-inset-bottom));
}

.state-card {
  padding: 20PX 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;

  h2 {
    font-size: 16PX;
    line-height: 1.25;
    color: $ink;
  }

  p {
    margin: 8PX 0 16PX;
    font-size: 14PX;
    line-height: 1.5;
    color: $ink-secondary;
    overflow-wrap: anywhere;
  }
}

.loading-text {
  margin-top: 12PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-muted;
}

.loading-hint {
  margin-top: 4PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $placeholder;
}

.skeleton {
  height: 14PX;
  border-radius: 8PX;
  background: $line-soft;
  animation: couple-pulse 1.6s ease-in-out infinite;
}

.skeleton-block {
  height: 120PX;
  margin-top: 12PX;
}

.skeleton-line.short {
  width: 55%;
  margin-top: 12PX;
}

@keyframes couple-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

.gate {
  padding: 24PX 20PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;
}

.gate-title {
  font-size: 20PX;
  font-weight: 700;
  line-height: 1.25;
  color: $ink;
}

.gate-desc {
  margin-top: 8PX;
  font-size: 14PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.gate-form {
  margin-top: 20PX;
}

.field-label {
  display: block;
  margin-bottom: 6PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.field-input {
  width: 100%;
  min-height: 44PX;
  padding: 10PX 12PX;
  font-size: 16PX;
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

.field-error {
  margin-top: 6PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $danger-text;
}

.gate-note {
  margin-top: 12PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.btn {
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;
  transition: background $motion-fast $ease-standard, border-color $motion-fast $ease-standard;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;

  &:active {
    background: $brand-action-dark;
  }
}

.btn-block {
  width: 100%;
  margin-top: 12PX;
}

.warn-banner {
  display: flex;
  gap: 10PX;
  margin-bottom: 12PX;
  padding: 12PX 14PX;
  background: $warning-tint;
  border: 1PX solid #f0d9a8;
  border-radius: 12PX;

  strong {
    display: block;
    font-size: 14PX;
    line-height: 1.5;
    color: $warning-text;
  }

  p {
    margin-top: 2PX;
    font-size: 12PX;
    line-height: 1.5;
    color: $ink-secondary;
  }

  code {
    font-size: 12PX;
    color: $ink;
  }
}

.warn-icon {
  font-size: 18PX;
  line-height: 1.2;
}

.tabs {
  display: flex;
  gap: 8PX;
  padding: 4PX;
  margin-bottom: 12PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.tab-button {
  flex: 1;
  min-height: 44PX;
  font-size: 14PX;
  font-weight: 500;
  color: $ink-secondary;
  background: transparent;
  border: none;
  border-radius: 8PX;
  cursor: pointer;
  transition: background $motion-fast $ease-standard, color $motion-fast $ease-standard;

  &.active {
    color: #fff;
    background: $brand-action;
  }
}

.panel:focus-visible {
  outline-offset: 4PX;
  border-radius: 12PX;
}

.page-foot {
  margin-top: 20PX;
  text-align: center;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

@media (min-width: 768px) {
  .couple {
    padding: 24PX 0 40PX;
  }

  .page-head,
  .page-body {
    max-width: $content-max;
  }

  .page-head {
    padding-left: 20PX;
    padding-right: 20PX;
    background: $surface;
    border: 1PX solid $line;
    border-radius: 20PX;
    margin-bottom: 20PX;
  }

  .page-body {
    padding: 0 8PX calc(24PX + env(safe-area-inset-bottom));
  }
}
</style>
