<script setup lang="ts">
// 零食日期管理：卡片列表 + 倒计时 + 搜索/筛选 + 增删改 + 临期提醒
// 无需登录，数据保存在服务端，多人访问看到同一份清单
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { snackApi, type SnackItem, type SnackPayload } from '@/api/snacks'
import SnackCard from '@/components/snacks/SnackCard.vue'
import SnackForm from '@/components/snacks/SnackForm.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()

const items = ref<SnackItem[]>([])
const nearDays = ref(7)
const loading = ref(true)
const keyword = ref('')
const filter = ref<'all' | 'near' | 'expired' | 'finished'>('all')

const formVisible = ref(false)
const editingItem = ref<SnackItem | null>(null)
const submitting = ref(false)
const settingsVisible = ref(false)
const nearDaysDraft = ref(7)
const savingSettings = ref(false)

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
  if (!silent) loading.value = true
  try {
    const res = await snackApi.list()
    items.value = res.items
    nearDays.value = res.settings.nearDays
    notifyAlerts()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    if (!silent) loading.value = false
  }
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

async function removeItem(item: SnackItem) {
  try {
    await showConfirmDialog({
      title: '删除记录',
      message: `确定删除「${item.name}」吗？对应的照片也会删除。`,
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }
  try {
    await snackApi.remove(item.id)
    showToast('已删除')
    await load(true)
  } catch {
    // 拦截器已提示
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
      <van-icon name="arrow-left" class="header-icon" @click="router.push('/')" />
      <h1>零食日期管理</h1>
      <van-icon name="setting-o" class="header-icon" @click="openSettings" />
    </header>

    <!-- 过期 / 临期提醒条 -->
    <div v-if="alertItems.length" class="alert-bar">
      <van-notice-bar
        color="#ee0a24"
        background="rgba(238,10,36,0.06)"
        left-icon="warning-o"
        :text="alertText"
        wrapable
      />
      <van-button
        v-if="notifySupported && notifyPermission !== 'granted'"
        size="small"
        round
        plain
        type="danger"
        class="notify-btn"
        @click="requestPermission"
      >
        开启通知提醒
      </van-button>
    </div>

    <main class="page-body">
      <van-search
        v-model="keyword"
        placeholder="搜索零食名称 / 品牌"
        shape="round"
        class="search-bar"
      />

      <div class="filter-row">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          class="filter-chip"
          :class="{ active: filter === f.key }"
          @click="filter = f.key"
        >
          {{ f.label }}
          <span class="count">{{ stats[f.key] }}</span>
        </button>
      </div>

      <div v-if="loading" class="loading-block">
        <van-loading size="20" vertical>加载中...</van-loading>
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
    <button class="fab press" @click="openCreate">
      <van-icon name="plus" />
      <span>添加零食</span>
    </button>

    <!-- 新增/编辑弹层 -->
    <SnackForm
      v-model="formVisible"
      :item="editingItem"
      :submitting="submitting"
      @submit="onSubmit"
    />

    <!-- 提醒阈值设置 -->
    <van-popup v-model:show="settingsVisible" position="bottom" round>
      <div class="settings-panel">
        <h2 class="settings-title">提醒设置</h2>
        <van-cell-group inset>
          <van-cell title="临近过期提醒阈值" :label="`距离到期 ${nearDaysDraft} 天内视为临近过期`">
            <template #value>
              <van-stepper v-model="nearDaysDraft" min="1" max="60" integer />
            </template>
          </van-cell>
        </van-cell-group>
        <div class="settings-actions">
          <van-button round block type="primary" :loading="savingSettings" @click="saveSettings">
            保存
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped lang="scss">
.snacks-page {
  min-height: 100vh;
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
  background: $bg-page;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  // 高度随安全区自动增高：固定高度 + padding-top 会把标题挤出头部，被下方提示条遮住
  min-height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  background: linear-gradient(135deg, #ff6b35 0%, #ff9f43 100%);
  color: #fff;

  h1 {
    font-size: $font-lg;
    font-weight: $font-bold;
  }
}

.header-icon {
  font-size: 20px;
  padding: 6px;
}

.alert-bar {
  padding: 10px 12px 0;
  background: #fff;
}

.notify-btn {
  margin: 8px 0 0 12px;
}

.page-body {
  padding: 0 12px;
}

.search-bar {
  padding: 8px 0;
  background: transparent;
}

.filter-row {
  display: flex;
  gap: 8px;
  padding: 2px 0 10px;
  overflow-x: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.filter-chip {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  font-size: $font-sm;
  color: $text-secondary;
  background: #fff;
  border: 1px solid $border;
  border-radius: $radius-full;

  &.active {
    color: #fff;
    background: $primary;
    border-color: $primary;
    font-weight: $font-medium;
  }
}

.count {
  font-size: $font-xs;
  opacity: 0.8;
}

.loading-block {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-tip {
  padding: 18px 4px 0;
  text-align: center;
  font-size: $font-xs;
  color: $text-hint;
}

.fab {
  position: fixed;
  right: 16px;
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 18px;
  font-size: $font-md;
  font-weight: $font-medium;
  color: #fff;
  background: $primary-gradient;
  border: none;
  border-radius: $radius-full;
  box-shadow: 0 6px 18px rgba(255, 107, 53, 0.4);

  .van-icon {
    font-size: 18px;
  }
}

.settings-panel {
  padding: 20px 0 calc(20px + env(safe-area-inset-bottom));
  background: $bg-page;
  border-radius: $radius-lg $radius-lg 0 0;
}

.settings-title {
  padding: 0 20px 14px;
  font-size: $font-lg;
  font-weight: $font-bold;
}

.settings-actions {
  padding: 20px 16px 0;
}
</style>
