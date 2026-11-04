<script setup lang="ts">
// 零食日期管理：卡片列表 + 倒计时 + 搜索/筛选 + 增删改 + 临期提醒
// 无需登录，数据保存在服务端，多人访问看到同一份清单
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { snackApi, type SnackItem, type SnackPayload } from '@/api/snacks'
import SnackCard from '@/components/snacks/SnackCard.vue'
import SnackForm from '@/components/snacks/SnackForm.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()

const items = ref<SnackItem[]>([])
const nearDays = ref(7)
const loading = ref(true)
const loadError = ref(false)
const keyword = ref('')
const filter = ref<'all' | 'near' | 'expired' | 'finished'>('all')

const formVisible = ref(false)
const editingItem = ref<SnackItem | null>(null)
const submitting = ref(false)
const settingsVisible = ref(false)
const nearDaysDraft = ref(7)
const savingSettings = ref(false)

// 删除确认（自定义弹窗，支持 Esc 关闭与焦点管理）
const confirmVisible = ref(false)
const confirmTarget = ref<SnackItem | null>(null)
const confirmMessage = computed(() =>
  confirmTarget.value
    ? `确定删除「${confirmTarget.value.name}」吗？对应的照片也会删除。`
    : ''
)

type FilterKey = 'all' | 'near' | 'expired' | 'finished'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'near', label: '临近过期' },
  { key: 'expired', label: '已过期' },
  { key: 'finished', label: '已用完' },
]

// ---------- 日期与状态计算（本地时区，按天比较） ----------
function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysLeft(item: SnackItem): number {
  const [y, m, d] = item.expireDate.split('-').map(Number)
  const target = new Date(y, m - 1, d, 0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function statusOf(item: SnackItem): 'expired' | 'near' | 'normal' | 'finished' {
  if (item.finished) return 'finished'
  const d = daysLeft(item)
  if (d < 0) return 'expired'
  if (d <= nearDays.value) return 'near'
  return 'normal'
}

// ---------- 统计 / 筛选 ----------
const stats = computed(() => {
  const result = { all: 0, near: 0, expired: 0, finished: 0 }
  for (const it of items.value) {
    const s = statusOf(it)
    if (s === 'finished') {
      result.finished += 1
      continue
    }
    result.all += 1
    if (s === 'expired') result.expired += 1
    if (s === 'near') result.near += 1
  }
  return result
})

const visibleItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = items.value.filter((it) => {
    if (kw && !(`${it.name}${it.brand}`.toLowerCase().includes(kw))) return false
    const s = statusOf(it)
    if (filter.value === 'finished') return s === 'finished'
    if (s === 'finished') return false
    if (filter.value === 'near') return s === 'near'
    if (filter.value === 'expired') return s === 'expired'
    return true
  })
  // 默认按到期日由近到远；已吃完的排在最后（按归档时间倒序）
  list = list.slice().sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? 1 : -1
    if (a.finished) return (b.finishedAt || '').localeCompare(a.finishedAt || '')
    return a.expireDate.localeCompare(b.expireDate)
  })
  return list
})

// 需要提醒的记录：已过期 + 临近过期（未吃完）
const alertItems = computed(() =>
  items.value
    .filter((it) => {
      const s = statusOf(it)
      return s === 'expired' || s === 'near'
    })
    .sort((a, b) => a.expireDate.localeCompare(b.expireDate))
)

const alertText = computed(() => {
  if (!alertItems.value.length) return ''
  const expired = alertItems.value.filter((it) => statusOf(it) === 'expired').length
  const near = alertItems.value.length - expired
  return `已过期 ${expired} 件，临近过期 ${near} 件，请尽快处理`
})

const notifySupported = computed(() => typeof window !== 'undefined' && 'Notification' in window)
const notifyPermission = ref<NotificationPermission>(
  notifySupported.value ? Notification.permission : 'denied'
)

const NOTIFY_STORE_KEY = 'snack_notified_records'

// 浏览器通知：同一记录同一状态每天只提醒一次，避免重复弹窗
function notifyAlerts() {
  if (!notifySupported.value || notifyPermission.value !== 'granted') return
  if (!alertItems.value.length) return

  const today = todayStr()
  let store: Record<string, string[]> = {}
  try {
    store = JSON.parse(localStorage.getItem(NOTIFY_STORE_KEY) || '{}')
  } catch {
    store = {}
  }
  const sent = new Set(store[today] || [])
  const fresh = alertItems.value.filter((it) => !sent.has(`${it.id}:${statusOf(it)}`))
  if (!fresh.length) return

  const expiredCount = fresh.filter((it) => statusOf(it) === 'expired').length
  const nearCount = fresh.length - expiredCount
  const names = fresh.slice(0, 3).map((it) => it.name).join('、')
  const body = `${expiredCount ? `已过期 ${expiredCount} 件；` : ''}${
    nearCount ? `临近过期 ${nearCount} 件；` : ''
  }${names}${fresh.length > 3 ? ' 等' : ''}`

  try {
    const notification = new Notification('零食保质期提醒', {
      body,
      tag: 'snack-expire-alert',
      icon: '/icons/icon-192.png',
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // 部分浏览器（如 iOS Safari）不支持，忽略即可
    return
  }

  store[today] = Array.from(new Set([...sent, ...fresh.map((it) => `${it.id}:${statusOf(it)}`)]))
  // 只保留当天记录，避免无限增长
  localStorage.setItem(NOTIFY_STORE_KEY, JSON.stringify({ [today]: store[today] }))
}

async function requestPermission() {
  if (!notifySupported.value) {
    showToast('当前浏览器不支持通知')
    return
  }
  try {
    const result = await Notification.requestPermission()
    notifyPermission.value = result
    if (result === 'granted') {
      showToast('已开启到期提醒')
      notifyAlerts()
    } else {
      showToast('未获得通知权限')
    }
  } catch {
    showToast('通知权限申请失败')
  }
}

// ---------- 数据加载 / 定时刷新 ----------
async function load(silent = false) {
  if (!silent) {
    loading.value = true
    loadError.value = false
  }
  try {
    const res = await snackApi.list()
    items.value = res.items
    nearDays.value = res.settings.nearDays
    loadError.value = false
    notifyAlerts()
  } catch {
    // 请求拦截器仍有 toast；这里是常驻错误态（轮询失败不打断当前列表）
    if (!silent) loadError.value = true
  } finally {
    if (!silent) loading.value = false
  }
}

function retryLoad() {
  load(false)
}

let timer: number | null = null

function startPolling() {
  stopPolling()
  // 定时刷新：保证能看到他人新增的记录
  timer = window.setInterval(() => load(true), 20000)
}

function stopPolling() {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') load(true)
}

onMounted(() => {
  load()
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

// ---------- 增删改 ----------
function openCreate() {
  editingItem.value = null
  formVisible.value = true
}

function openEdit(item: SnackItem) {
  editingItem.value = item
  formVisible.value = true
}

async function onSubmit(payload: SnackPayload) {
  submitting.value = true
  try {
    if (editingItem.value) {
      await snackApi.update(editingItem.value.id, payload)
      showToast('已保存修改')
    } else {
      await snackApi.create(payload)
      showToast('已添加')
    }
    formVisible.value = false
    await load(true)
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

async function toggleFinish(item: SnackItem) {
  try {
    await snackApi.finish(item.id, !item.finished)
    showToast(item.finished ? '已取消归档' : '已标记吃完')
    await load(true)
  } catch {
    // 拦截器已提示
  }
}

function removeItem(item: SnackItem) {
  confirmTarget.value = item
  confirmVisible.value = true
}

async function confirmRemove() {
  const target = confirmTarget.value
  if (!target) return
  try {
    await snackApi.remove(target.id)
    showToast('已删除')
    await load(true)
  } catch {
    // 拦截器已提示
  } finally {
    confirmTarget.value = null
  }
}

// ---------- 提醒阈值设置 ----------
function openSettings() {
  nearDaysDraft.value = nearDays.value
  settingsVisible.value = true
}

async function saveSettings() {
  savingSettings.value = true
  try {
    const res = await snackApi.updateSettings(nearDaysDraft.value)
    nearDays.value = res.nearDays
    settingsVisible.value = false
    showToast('提醒阈值已更新')
    await load(true)
  } catch {
    // 拦截器已提示
  } finally {
    savingSettings.value = false
  }
}
</script>

<template>
  <div class="snacks-page">
    <header class="page-header">
      <div class="header-inner">
        <button type="button" class="icon-btn" aria-label="返回入口页" @click="router.push('/')">
          <van-icon name="arrow-left" aria-hidden="true" />
        </button>
        <h1>零食日期管理</h1>
        <button type="button" class="icon-btn" aria-label="提醒设置" @click="openSettings">
          <van-icon name="setting-o" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="page-body">
      <!-- 过期 / 临期提醒条 -->
      <div v-if="alertItems.length" class="alert-bar" role="status">
        <div class="alert-main">
          <van-icon name="warning-o" class="alert-icon" aria-hidden="true" />
          <p class="alert-text">{{ alertText }}</p>
        </div>
        <button
          v-if="notifySupported && notifyPermission !== 'granted'"
          type="button"
          class="alert-btn"
          @click="requestPermission"
        >
          开启通知提醒
        </button>
      </div>

      <van-search
        v-model="keyword"
        placeholder="搜索零食名称 / 品牌"
        class="search-bar"
      />

      <div class="filter-row">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="filter-chip"
          :class="{ active: filter === f.key }"
          :aria-pressed="filter === f.key"
          @click="filter = f.key"
        >
          {{ f.label }}
          <span class="count" aria-hidden="true">{{ stats[f.key] }}</span>
        </button>
      </div>

      <div v-if="loading" class="loading-block" role="status" aria-live="polite">
        <van-loading size="20PX" vertical>加载中…</van-loading>
      </div>

      <div v-else-if="loadError" class="error-block" role="alert">
        <span class="error-emoji" aria-hidden="true">📡</span>
        <p class="error-title">清单加载失败</p>
        <p class="error-desc">请检查网络连接后重试，已有数据不会丢失</p>
        <button type="button" class="error-retry" @click="retryLoad">重试</button>
      </div>

      <template v-else>
        <div v-if="visibleItems.length" class="card-list">
          <SnackCard
            v-for="item in visibleItems"
            :key="item.id"
            :item="item"
            :near-days="nearDays"
            @edit="openEdit"
            @toggle-finish="toggleFinish"
            @remove="removeItem"
          />
        </div>
        <EmptyState v-else :description="keyword ? '没有匹配的零食' : '还没有记录，点右下角添加吧'" />
      </template>

      <p class="list-tip">清单实时共享，每 20 秒自动刷新 · 默认按到期日由近到远排序</p>
    </main>

    <!-- 新增按钮 -->
    <button type="button" class="fab press" @click="openCreate">
      <van-icon name="plus" aria-hidden="true" />
      <span>添加零食</span>
    </button>

    <!-- 新增/编辑弹层 -->
    <SnackForm
      v-model="formVisible"
      :item="editingItem"
      :submitting="submitting"
      @submit="onSubmit"
    />

    <!-- 删除确认（支持 Esc 关闭、焦点陷阱与归还） -->
    <ConfirmDialog
      v-model:show="confirmVisible"
      title="删除记录"
      :message="confirmMessage"
      confirm-text="删除"
      danger
      @confirm="confirmRemove"
    />

    <!-- 提醒阈值设置 -->
    <van-popup v-model:show="settingsVisible" position="bottom" round class="settings-popup">
      <div class="settings-panel">
        <h2 class="settings-title">提醒设置</h2>
        <div class="settings-group">
          <van-cell title="临近过期提醒阈值" :label="`距离到期 ${nearDaysDraft} 天内视为临近过期`">
            <template #value>
              <van-stepper v-model="nearDaysDraft" min="1" max="60" integer />
            </template>
          </van-cell>
        </div>
        <div class="settings-actions">
          <van-button block type="primary" :loading="savingSettings" @click="saveSettings">
            保存
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped lang="scss">
// 本页统一使用大写 PX：绕开项目的 px→vw（375 设计稿）转换，
// 移动端与设计稿 1:1，桌面 1440 不再被等比放大。
.snacks-page {
  min-height: 100vh;
  padding-bottom: calc(96PX + env(safe-area-inset-bottom));
  background: $bg-warm;
  color: $ink;
}

// ---------- 头部 ----------
.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: env(safe-area-inset-top);
  background: $bg-warm;
  border-bottom: 1PX solid $line;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 4PX;
  width: 100%;
  max-width: $content-max;
  min-height: 56PX;
  margin: 0 auto;
  padding: 0 10PX;
}

.page-header h1 {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 18PX;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.2PX;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44PX;
  height: 44PX;
  font-size: 20PX;
  color: $ink;
  background: transparent;
  border: 1PX solid transparent;
  border-radius: 12PX;
  cursor: pointer;
  transition: background $motion-fast $ease-standard;

  &:active {
    background: #ece6de;
  }
}

// ---------- 主体 ----------
.page-body {
  width: 100%;
  max-width: $content-max;
  margin: 0 auto;
  padding: 12PX 16PX 0;
}

// ---------- 提醒条 ----------
.alert-bar {
  display: flex;
  flex-direction: column;
  gap: 8PX;
  margin-bottom: 8PX;
  padding: 12PX 14PX;
  background: $danger-tint;
  border: 1PX solid #f2d6d9;
  border-radius: 12PX;
}

.alert-main {
  display: flex;
  align-items: flex-start;
  gap: 8PX;
}

.alert-icon {
  flex: none;
  margin-top: 2PX;
  font-size: 16PX;
  color: $danger-text;
}

.alert-text {
  font-size: 13PX;
  line-height: 1.5;
  color: $danger-text;
}

.alert-btn {
  align-self: flex-start;
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 13PX;
  font-weight: 500;
  line-height: 1.5;
  color: $danger-text;
  background: $surface;
  border: 1PX solid #f2d6d9;
  border-radius: 8PX;
  cursor: pointer;
  transition: background $motion-fast $ease-standard;

  &:active {
    background: #fbe6e6;
  }
}

// ---------- 搜索 ----------
.search-bar {
  padding: 0;
  background: transparent;
  // 钉住根字号：Vant 默认继承 --van-font-size-md（已被 px→vw 转成 3.73vw，
  // 桌面 1440 会算成 53.76px，导致图标与占位符被放大裁切）
  font-size: 14PX;
  line-height: 1.5;

  :deep(.van-search__content) {
    align-items: center;
    height: 44PX;
    padding-left: 12PX;
    background: $surface;
    border: 1PX solid $line;
    border-radius: 12PX;
  }

  :deep(.van-search__field) {
    align-items: center;
    height: 44PX;
    padding: 0;
    font-size: 14PX;
    line-height: 1.5;
  }

  :deep(.van-field__control) {
    height: 44PX;
    font-size: 14PX;
    line-height: 1.5;
    color: $ink;
  }

  :deep(.van-field__left-icon) {
    margin-right: 8PX;
  }

  :deep(.van-field__left-icon .van-icon) {
    font-size: 16PX;
    color: $ink-muted;
  }
}

// ---------- 筛选 ----------
.filter-row {
  display: flex;
  gap: 8PX;
  padding: 10PX 0 12PX;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.filter-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6PX;
  min-height: 44PX;
  padding: 0 14PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: $radius-full;
  cursor: pointer;
  transition: background $motion-fast $ease-standard, border-color $motion-fast $ease-standard,
    color $motion-fast $ease-standard;

  &.active {
    color: #fff;
    background: $brand-action;
    border-color: $brand-action;
    font-weight: 500;
  }
}

.count {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.filter-chip.active .count {
  color: #fff;
}

// ---------- 状态区块 ----------
.loading-block {
  display: flex;
  justify-content: center;
  padding: 60PX 0;
}

.error-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 4PX;
  padding: 36PX 20PX 32PX;
  text-align: center;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.error-emoji {
  font-size: 26PX;
  line-height: 1;
}

.error-title {
  margin-top: 10PX;
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.25;
  color: $ink;
}

.error-desc {
  margin-top: 6PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.error-retry {
  min-height: 44PX;
  margin-top: 16PX;
  padding: 0 28PX;
  font-size: 14PX;
  font-weight: 500;
  color: #fff;
  background: $brand-action;
  border: none;
  border-radius: 12PX;
  cursor: pointer;
  transition: background $motion-fast $ease-standard;

  &:active {
    background: $brand-action-dark;
  }
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 10PX;
}

.list-tip {
  padding: 18PX 4PX 0;
  text-align: center;
  font-size: 12PX;
  line-height: 1.6;
  color: $ink-muted;
}

// ---------- 新增按钮 ----------
.fab {
  position: fixed;
  // 移动端贴右，桌面跟随内容列（760PX 居中）右缘
  right: max(16PX, calc(50vw - 364PX));
  bottom: calc(24PX + env(safe-area-inset-bottom));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 6PX;
  min-height: 44PX;
  padding: 0 18PX;
  font-size: 14PX;
  font-weight: 500;
  color: #fff;
  background: $brand-action;
  border: none;
  border-radius: $radius-full;
  box-shadow: 0 4PX 14PX rgba(194, 65, 12, 0.28);
  cursor: pointer;
  transition: background $motion-fast $ease-standard;

  .van-icon {
    font-size: 16PX;
  }

  &:active {
    background: $brand-action-dark;
  }
}

// ---------- 提醒设置弹层 ----------
.settings-panel {
  width: 100%;
  max-width: $content-max;
  margin: 0 auto;
  padding: 20PX 0 calc(20PX + env(safe-area-inset-bottom));

  // 钉住 Vant 内部尺寸，避免桌面被 vw 放大
  --van-cell-font-size: 14PX;
  --van-cell-line-height: 24PX;
  --van-cell-vertical-padding: 12PX;
  --van-cell-horizontal-padding: 20PX;
  --van-stepper-input-height: 44PX;
  --van-stepper-button-width: 44PX;
  --van-stepper-input-width: 56PX;
  --van-stepper-input-font-size: 14PX;
  --van-button-default-height: 48PX;
  --van-cell-icon-size: 16PX;

  :deep(.van-cell) {
    background: $surface;
  }

  :deep(.van-cell::after) {
    border-color: $line-soft;
  }

  :deep(.van-cell__label) {
    color: $ink-muted;
    font-size: 12PX;
    line-height: 1.5;
  }

  :deep(.van-button--primary) {
    height: 48PX;
    font-size: 16PX;
    border: none;
    border-radius: 12PX;
    background: $brand-action;
  }
}

.settings-title {
  padding: 0 20PX 12PX;
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.25;
  color: $ink;
}

.settings-group {
  margin: 0 16PX;
  overflow: hidden;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.settings-actions {
  padding: 20PX 16PX 0;
}

@media (min-width: 768px) {
  .page-header {
    // 桌面：头部收成与内容同宽的卡片，和入口页保持一致的视觉语言
    top: 12PX;
    max-width: $content-max;
    margin: 12PX auto 0;
    border: 1PX solid $line;
    border-radius: 16PX;
    overflow: hidden;
  }

  .settings-popup {
    // 底部弹层同样收成 760PX 居中
    left: 50%;
    right: auto;
    width: $content-max;
    margin-left: calc($content-max / -2);
    border-radius: 16PX 16PX 0 0;
  }

  .page-body {
    padding-left: 24PX;
    padding-right: 24PX;
  }

  .header-inner {
    padding: 0 14PX;
  }
}
</style>
