<script setup lang="ts">
// 打卡面板：每日打卡（双方各点一次 + 连续天数 + 日历小格）、一起做的事、小约定
import { computed, nextTick, ref, watch } from 'vue'
import { showToast } from 'vant'
import {
  CoupleApiError,
  coupleApi,
  type CheckinSummary,
  type CoupleProfile,
  type CoupleTodo,
  type CoupleWish,
} from '@/api/couple'
import CheckinSheet from './CheckinSheet.vue'
import CheckinDaySheet from './CheckinDaySheet.vue'
import { moodLabel } from '../mood'

const props = defineProps<{
  checkin: CheckinSummary
  todos: CoupleTodo[]
  wishes: CoupleWish[]
  profiles: CoupleProfile[]
  today: string
  // 从首页弹幕点进来时，直接展开这条约定的回复框
  focusWishId?: string
}>()

const emit = defineEmits<{
  (event: 'wishes-changed', wishes: CoupleWish[]): void
}>()

const summary = ref<CheckinSummary>({ ...props.checkin })
const todoList = ref<CoupleTodo[]>([...props.todos])
const wishList = ref<CoupleWish[]>([...props.wishes])

// 打卡弹层与当天详情
const checkinSlot = ref<1 | 2 | null>(null)
const checkinShow = computed<boolean>({
  get: () => checkinSlot.value !== null,
  set: (value) => {
    if (!value) checkinSlot.value = null
  },
})
const dayDate = ref('')
const dayShow = ref(false)

function openCheckin(slot: 1 | 2): void {
  checkinSlot.value = slot
}

function openDay(date: string): void {
  dayDate.value = date
  dayShow.value = true
}

function onCheckinSaved(next: CheckinSummary): void {
  summary.value = { ...next }
}

watch(
  () => props.checkin,
  (value) => {
    summary.value = { ...value }
  }
)
watch(
  () => props.todos,
  (value) => {
    todoList.value = [...value]
  }
)
watch(
  () => props.wishes,
  (value) => {
    wishList.value = [...value]
  }
)

function errorMessage(error: unknown): string {
  if (error instanceof CoupleApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}

function nameOf(slot: 1 | 2): string {
  const profile = props.profiles.find((item) => item.slot === slot)
  return profile?.displayName || (slot === 1 ? '我' : 'TA')
}

function slotState(slot: 1 | 2) {
  return (
    summary.value.slots.find((item) => item.slot === slot) || {
      slot,
      done: false,
      time: null,
      mood: '',
      moodText: '',
      note: '',
      likes: [],
    }
  )
}

function timeOf(raw: string | null): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function checkinHint(slot: 1 | 2): string {
  const state = slotState(slot)
  if (!state.done) return '点我打卡'
  const mood = moodLabel(state.mood)
  return `${mood ? `${mood} · ` : ''}${timeOf(state.time)} 已打卡`
}

function shortDate(raw: string | null): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const calendarCells = computed<Array<{ date: string; count: number } | null>>(() => {
  const days = summary.value.days.slice(-21)
  if (!days.length) return []
  const first = new Date(`${days[0].date}T00:00:00`)
  const offset = Number.isNaN(first.getTime()) ? 0 : (first.getDay() + 6) % 7
  const blanks = Array.from({ length: offset }, () => null)
  return [...blanks, ...days]
})

function cellLabel(cell: { date: string; count: number }): string {
  const text = cell.count === 2 ? '两人都打卡' : cell.count === 1 ? '一人打卡' : '没有打卡'
  return `${cell.date.slice(5)}：${text}`
}

// ---------- 一起做的事 ----------
const todoDraft = ref('')
const todoAdding = ref(false)
const todoBusyId = ref('')
const todoError = ref('')

const todoDone = computed(() => todoList.value.filter((item) => item.done).length)
const todoProgress = computed(() =>
  todoList.value.length ? Math.round((todoDone.value / todoList.value.length) * 100) : 0
)
const sortedTodos = computed(() => [...todoList.value].sort((a, b) => Number(a.done) - Number(b.done)))

async function addTodo(): Promise<void> {
  const title = todoDraft.value.trim()
  todoError.value = ''
  if (!title) {
    todoError.value = '先写一件想一起做的事'
    return
  }
  if (todoAdding.value) return
  todoAdding.value = true
  try {
    const result = await coupleApi.addTodo(title)
    todoList.value = [...todoList.value, result.todo]
    todoDraft.value = ''
    showToast('已加入清单')
  } catch (error) {
    todoError.value = errorMessage(error)
  } finally {
    todoAdding.value = false
  }
}

async function toggleTodo(item: CoupleTodo): Promise<void> {
  if (todoBusyId.value) return
  todoBusyId.value = item.id
  try {
    const result = await coupleApi.setTodoDone(item.id, !item.done)
    todoList.value = todoList.value.map((row) => (row.id === item.id ? result.todo : row))
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    todoBusyId.value = ''
  }
}

async function removeTodo(item: CoupleTodo): Promise<void> {
  if (todoBusyId.value) return
  todoBusyId.value = item.id
  try {
    await coupleApi.removeTodo(item.id)
    todoList.value = todoList.value.filter((row) => row.id !== item.id)
    showToast('已删除')
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    todoBusyId.value = ''
  }
}

// ---------- 小约定 ----------
const wishDraft = ref('')
const wishFrom = ref<1 | 2>(1)
const wishAdding = ref(false)
const wishBusyId = ref('')
const wishError = ref('')

const sortedWishes = computed(() =>
  [...wishList.value].sort((a, b) => {
    const weight = (status: CoupleWish['status']) => (status === 'open' ? 0 : 1)
    if (weight(a.status) !== weight(b.status)) return weight(a.status) - weight(b.status)
    return b.createdAt.localeCompare(a.createdAt)
  })
)

async function addWish(): Promise<void> {
  const content = wishDraft.value.trim()
  wishError.value = ''
  if (!content) {
    wishError.value = '写下这个小约定吧'
    return
  }
  if (wishAdding.value) return
  wishAdding.value = true
  try {
    const result = await coupleApi.addWish(content, wishFrom.value)
    wishList.value = [result.wish, ...wishList.value]
    emit('wishes-changed', wishList.value)
    wishDraft.value = ''
    showToast('已发起，等 TA 回应')
  } catch (error) {
    wishError.value = errorMessage(error)
  } finally {
    wishAdding.value = false
  }
}

async function respondWish(item: CoupleWish, status: 'accepted' | 'declined'): Promise<void> {
  if (wishBusyId.value) return
  wishBusyId.value = item.id
  try {
    const result = await coupleApi.respondWish(item.id, status)
    wishList.value = wishList.value.map((row) => (row.id === item.id ? result.wish : row))
    emit('wishes-changed', wishList.value)
    showToast(status === 'accepted' ? '已经答应啦' : '先记下来，再想想')
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    wishBusyId.value = ''
  }
}

async function removeWish(item: CoupleWish): Promise<void> {
  if (wishBusyId.value) return
  wishBusyId.value = item.id
  try {
    await coupleApi.removeWish(item.id)
    wishList.value = wishList.value.filter((row) => row.id !== item.id)
    emit('wishes-changed', wishList.value)
    showToast('已删除')
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    wishBusyId.value = ''
  }
}

function wishStatusText(item: CoupleWish): string {
  if (item.status === 'accepted') {
    return `${item.respondedSlot ? nameOf(item.respondedSlot) : 'TA'} 答应了`
  }
  if (item.status === 'declined') {
    return `${item.respondedSlot ? nameOf(item.respondedSlot) : 'TA'} 想再等等`
  }
  return '等回应'
}

// ---------- 小约定：文字回复 ----------
const replyOpenId = ref('')
const replyDraft = ref('')
const replySlot = ref<1 | 2>(1)
const replyBusy = ref(false)
const replyError = ref('')

function openReply(item: CoupleWish): void {
  if (replyOpenId.value === item.id) {
    replyOpenId.value = ''
    return
  }
  replyOpenId.value = item.id
  replyDraft.value = ''
  replyError.value = ''
  // 默认以「另一方」身份回复：发起的对侧更像那个要回应的人
  replySlot.value = item.fromSlot === 1 ? 2 : 1
}

async function sendReply(item: CoupleWish): Promise<void> {
  const content = replyDraft.value.trim()
  replyError.value = ''
  if (!content) {
    replyError.value = '写点什么再发送吧'
    return
  }
  if (replyBusy.value) return
  replyBusy.value = true
  try {
    const result = await coupleApi.replyWish(item.id, replySlot.value, content)
    wishList.value = wishList.value.map((row) => (row.id === item.id ? result.wish : row))
    emit('wishes-changed', wishList.value)
    replyDraft.value = ''
    replyOpenId.value = ''
    showToast('回复已送达')
  } catch (error) {
    replyError.value = errorMessage(error)
  } finally {
    replyBusy.value = false
  }
}

// 从首页弹幕点进来：滚到这条约定并展开回复框
watch(
  () => props.focusWishId,
  async (id) => {
    if (!id) return
    const item = wishList.value.find((row) => row.id === id)
    if (!item) return
    replyOpenId.value = id
    replySlot.value = item.fromSlot === 1 ? 2 : 1
    replyDraft.value = ''
    await nextTick()
    const field = document.getElementById(`wish-reply-${id}`)
    field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    field?.focus({ preventScroll: true })
  },
  { immediate: true }
)
</script>

<template>
  <div class="daily">
    <!-- 每日打卡 -->
    <section class="card" aria-labelledby="checkin-title">
      <div class="card-head">
        <h2 id="checkin-title">每日打卡</h2>
        <span class="card-tag">双方各点一次</span>
      </div>

      <div class="streak">
        <span class="streak-num">{{ summary.currentStreak }}</span>
        <span class="streak-unit">天连续</span>
        <span class="streak-best">最长 {{ summary.bestStreak }} 天</span>
      </div>
      <p class="streak-note">
        {{
          summary.currentStreak > 0
            ? '今天两个人都打卡，连续天数 +1'
            : '从今天开始，两个人都点一下就有连续记录'
        }}
      </p>

      <div class="checkin-row">
        <button
          v-for="slot in ([1, 2] as const)"
          :key="slot"
          type="button"
          class="checkin-btn"
          :class="{ 'is-done': slotState(slot).done }"
          :aria-pressed="slotState(slot).done"
          @click="openCheckin(slot)"
        >
          <span class="checkin-avatar" aria-hidden="true">
            <img
              v-if="profiles.find((p) => p.slot === slot)?.avatarUrl"
              :src="profiles.find((p) => p.slot === slot)?.avatarUrl"
              alt=""
            />
            <svg v-else viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="30" fill="#FBF1EA" stroke="#E7D3C5" stroke-width="1.5" />
              <circle cx="32" cy="26" r="9" fill="#D9C7B8" />
              <path d="M14 54c2-9.5 9-14.5 18-14.5s16 5 18 14.5" fill="#D9C7B8" />
            </svg>
          </span>
          <span class="checkin-text">
            <span class="checkin-name">{{ nameOf(slot) }}</span>
            <span class="checkin-state">{{ checkinHint(slot) }}</span>
            <span v-if="slotState(slot).note" class="checkin-note">{{ slotState(slot).note }}</span>
          </span>
        </button>
      </div>

      <div class="calendar" role="group" aria-label="最近三周打卡记录">
        <div class="calendar-week" aria-hidden="true">
          <span v-for="label in WEEK_LABELS" :key="label">{{ label }}</span>
        </div>
        <div class="calendar-grid">
          <template v-for="(cell, index) in calendarCells" :key="cell ? cell.date : `blank-${index}`">
            <span v-if="!cell" class="calendar-cell is-blank" aria-hidden="true" />
            <button
              v-else
              type="button"
              class="calendar-cell"
              :class="`count-${cell.count}`"
              :aria-label="cellLabel(cell)"
              @click="openDay(cell.date)"
            >
              <span class="cell-num">{{ Number(cell.date.slice(8)) }}</span>
              <span class="cell-marks" aria-hidden="true">
                <i /><i />
              </span>
            </button>
          </template>
        </div>
        <div class="calendar-legend">
          <span><i class="legend-cell is-both" aria-hidden="true"><i /><i /></i>两人都打卡</span>
          <span><i class="legend-cell is-one" aria-hidden="true"><i /><i /></i>只有一人</span>
          <span><i class="legend-cell is-none" aria-hidden="true" />没人打卡</span>
        </div>
      </div>
    </section>

    <!-- 一起做的事 -->
    <section class="card" aria-labelledby="todo-title">
      <div class="card-head">
        <h2 id="todo-title">一起做的事</h2>
        <span class="card-tag">{{ todoDone }} / {{ todoList.length }}</span>
      </div>

      <div
        class="progress"
        role="progressbar"
        :aria-valuemin="0"
        :aria-valuemax="todoList.length || 100"
        :aria-valuenow="todoList.length ? todoDone : 0"
        :aria-label="`已完成 ${todoDone} 件，共 ${todoList.length} 件`"
      >
        <span class="progress-fill" :style="{ width: `${todoList.length ? todoProgress : 0}%` }" />
      </div>
      <p class="progress-text">
        {{ todoList.length ? `已完成 ${todoDone} 件，还剩 ${todoList.length - todoDone} 件` : '还没有清单' }}
      </p>

      <ul v-if="sortedTodos.length" class="todo-list">
        <li v-for="item in sortedTodos" :key="item.id" class="todo-item" :class="{ 'is-done': item.done }">
          <button
            type="button"
            class="todo-check"
            role="checkbox"
            :aria-checked="item.done"
            :aria-label="`${item.done ? '取消完成' : '标记完成'}：${item.title}`"
            :disabled="todoBusyId === item.id"
            @click="toggleTodo(item)"
          >
            <span class="todo-box">
              <svg v-if="item.done" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </button>
          <div class="todo-text">
            <p class="todo-title">{{ item.title }}</p>
            <p v-if="item.done" class="todo-date">{{ shortDate(item.doneAt) }} 完成</p>
          </div>
          <button
            type="button"
            class="icon-link"
            :aria-label="`删除：${item.title}`"
            :disabled="todoBusyId === item.id"
            @click="removeTodo(item)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14M9 7V5.5h6V7M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </li>
      </ul>
      <p v-else class="empty-line">还没有清单，写下第一件想一起做的事。</p>

      <form class="add-form" @submit.prevent="addTodo">
        <label class="sr-only" for="todo-input">要做的事</label>
        <input
          id="todo-input"
          v-model="todoDraft"
          class="input"
          type="text"
          maxlength="60"
          placeholder="例如：一起去看一次海"
          :aria-invalid="Boolean(todoError)"
          aria-describedby="todo-error"
        />
        <button type="submit" class="btn btn-primary" :disabled="todoAdding">
          {{ todoAdding ? '添加中…' : '添加' }}
        </button>
      </form>
      <p v-if="todoError" id="todo-error" class="error-text" role="alert">{{ todoError }}</p>
    </section>

    <!-- 小约定 / 心愿 -->
    <section class="card" aria-labelledby="wish-title">
      <div class="card-head">
        <h2 id="wish-title">小约定</h2>
        <span class="card-tag">{{ wishList.filter((item) => item.status === 'open').length }} 个等回应</span>
      </div>

      <ul v-if="sortedWishes.length" class="wish-list">
        <li v-for="item in sortedWishes" :key="item.id" class="wish-item">
          <div class="wish-head">
            <span class="wish-from">{{ nameOf(item.fromSlot) }} 发起</span>
            <span class="wish-status" :class="`status-${item.status}`">{{ wishStatusText(item) }}</span>
            <button
              type="button"
              class="icon-link"
              :aria-label="`删除约定：${item.content}`"
              :disabled="wishBusyId === item.id"
              @click="removeWish(item)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 7h14M9 7V5.5h6V7M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <p class="wish-content">{{ item.content }}</p>

          <ul v-if="item.replies.length" class="reply-list">
            <li v-for="reply in item.replies" :key="reply.id" class="reply-item">
              <span class="reply-author">{{ nameOf(reply.slot) }}</span>
              <p class="reply-content">{{ reply.content }}</p>
            </li>
          </ul>

          <button
            type="button"
            class="link-btn reply-toggle"
            :aria-expanded="replyOpenId === item.id"
            :aria-controls="`wish-reply-form-${item.id}`"
            @click="openReply(item)"
          >
            {{ replyOpenId === item.id ? '收起回复' : item.replies.length ? '继续回复' : '写文字回复' }}
          </button>

          <form
            v-if="replyOpenId === item.id"
            :id="`wish-reply-form-${item.id}`"
            class="reply-form"
            @submit.prevent="sendReply(item)"
          >
            <div class="reply-from" role="group" aria-label="选择回复身份">
              <button
                v-for="slot in ([1, 2] as const)"
                :key="slot"
                type="button"
                class="pick is-small"
                :class="{ 'is-active': replySlot === slot }"
                :aria-pressed="replySlot === slot"
                @click="replySlot = slot"
              >
                {{ nameOf(slot) }}
              </button>
            </div>
            <label class="sr-only" :for="`wish-reply-${item.id}`">回复内容</label>
            <textarea
              :id="`wish-reply-${item.id}`"
              v-model="replyDraft"
              class="input textarea"
              rows="3"
              maxlength="300"
              :placeholder="`以${nameOf(replySlot)}的身份回复…`"
            />
            <div class="reply-foot">
              <span class="reply-count">{{ Array.from(replyDraft).length }} / 300</span>
              <button type="submit" class="btn btn-primary" :disabled="replyBusy || !replyDraft.trim()">
                {{ replyBusy ? '发送中…' : '发送' }}
              </button>
            </div>
            <p v-if="replyError" class="error-text" role="alert">{{ replyError }}</p>
          </form>

          <div v-if="item.status === 'open'" class="wish-actions">
            <button type="button" class="btn btn-ghost" :disabled="wishBusyId === item.id" @click="respondWish(item, 'accepted')">
              好呀
            </button>
            <button type="button" class="btn btn-ghost" :disabled="wishBusyId === item.id" @click="respondWish(item, 'declined')">
              再想想
            </button>
          </div>
          <p v-else class="wish-meta">{{ shortDate(item.respondedAt) }} 回应</p>
        </li>
      </ul>
      <p v-else class="empty-line">还没有约定，写一个想和 TA 一起完成的小心愿。</p>

      <form class="add-form" @submit.prevent="addWish">
        <div class="wish-from-pick" role="group" aria-label="由谁发起">
          <button
            v-for="slot in ([1, 2] as const)"
            :key="slot"
            type="button"
            class="pick"
            :class="{ 'is-active': wishFrom === slot }"
            :aria-pressed="wishFrom === slot"
            @click="wishFrom = slot"
          >
            {{ nameOf(slot) }}
          </button>
        </div>
        <label class="sr-only" for="wish-input">小约定内容</label>
        <input
          id="wish-input"
          v-model="wishDraft"
          class="input"
          type="text"
          maxlength="80"
          placeholder="例如：这周早点睡，一起散步"
          :aria-invalid="Boolean(wishError)"
          aria-describedby="wish-error"
        />
        <button type="submit" class="btn btn-primary" :disabled="wishAdding">
          {{ wishAdding ? '发起中…' : '发起' }}
        </button>
      </form>
      <p v-if="wishError" id="wish-error" class="error-text" role="alert">{{ wishError }}</p>
    </section>

    <CheckinSheet
      v-model:show="checkinShow"
      :slot="checkinSlot || 1"
      :name="nameOf(checkinSlot || 1)"
      :state="checkinSlot ? slotState(checkinSlot) : null"
      @saved="onCheckinSaved"
    />
    <CheckinDaySheet v-model:show="dayShow" :day="dayDate" :profiles="profiles" />
  </div>
</template>

<style scoped lang="scss">
.daily {
  display: flex;
  flex-direction: column;
  gap: 12PX;
}

.card {
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

.streak {
  display: flex;
  align-items: baseline;
  gap: 6PX;
}

.streak-num {
  font-size: 22PX;
  font-weight: 700;
  line-height: 1.15;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.streak-unit {
  font-size: 14PX;
  color: $ink-secondary;
}

.streak-best {
  margin-left: auto;
  font-size: 12PX;
  color: $ink-muted;
}

.streak-note {
  margin-top: 4PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.checkin-row {
  display: flex;
  gap: 8PX;
  margin-top: 12PX;
}

.checkin-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8PX;
  min-height: 56PX;
  padding: 8PX 10PX;
  text-align: left;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;
  transition: background-color $motion-fast $ease-standard, border-color $motion-fast $ease-standard;

  &:hover {
    border-color: $line-strong;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &:disabled {
    cursor: progress;
  }

  &.is-done {
    background: $accent-soft;
    border-color: $accent-line;
  }
}

.checkin-avatar {
  flex: none;
  width: 32PX;
  height: 32PX;
  overflow: hidden;
  border: 1PX solid $line;
  border-radius: 50%;

  img,
  svg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.checkin-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.checkin-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13PX;
  font-weight: 600;
  line-height: 1.4;
  color: $ink;
}

.checkin-state {
  font-size: 12PX;
  line-height: 1.4;
  color: $ink-muted;
}

.checkin-note {
  display: -webkit-box;
  margin-top: 2PX;
  overflow: hidden;
  font-size: 12PX;
  line-height: 1.4;
  color: $ink-muted;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.calendar {
  margin: 14PX -6PX 0;
}

.calendar-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2PX;
  margin-bottom: 4PX;

  span {
    text-align: center;
    font-size: 12PX;
    line-height: 1.6;
    color: $ink-muted;
  }
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2PX;
}

// 三种状态不只靠颜色：虚线空心 / 实线单点 / 实心双点+强调描边
.calendar-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2PX;
  min-height: 46PX;
  padding: 0;
  font-size: 12PX;
  line-height: 1;
  color: $ink-muted;
  background: transparent;
  border: 1PX dashed $line-strong;
  border-radius: 8PX;
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &.is-blank {
    background: transparent;
    border-color: transparent;
    cursor: default;
  }

  &.count-0 {
    color: $ink-muted;
    background: $surface-sunken;
    border: 1PX dashed $line-strong;
  }

  &.count-1 {
    color: $ink-secondary;
    background: $line-soft;
    border: 1PX solid $ink-muted;
  }

  &.count-2 {
    color: $ink;
    font-weight: 600;
    background: $accent-soft;
    border: 1PX solid $brand-action;
  }

  &:hover:not(.is-blank) {
    border-color: $ink-secondary;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.cell-marks {
  display: inline-flex;
  gap: 2PX;
  height: 5PX;

  i {
    display: block;
    width: 5PX;
    height: 5PX;
    border-radius: 50%;
    border: 1PX solid $line-strong;
  }
}

.count-1 .cell-marks i:first-child {
  background: $ink-secondary;
  border-color: $ink-secondary;
}

.count-2 .cell-marks i {
  background: $brand-action;
  border-color: $brand-action;
}

.count-0 .cell-marks i {
  border-style: dashed;
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8PX 12PX;
  margin-top: 10PX;

  span {
    display: inline-flex;
    align-items: center;
    gap: 5PX;
    font-size: 12PX;
    line-height: 1.5;
    color: $ink-muted;
  }
}

.legend-cell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1PX;
  width: 14PX;
  height: 14PX;
  border-radius: 4PX;

  i {
    display: block;
    width: 3PX;
    height: 3PX;
    border-radius: 50%;
  }

  &.is-both {
    background: $accent-soft;
    border: 1PX solid $brand-action;

    i {
      background: $brand-action;
    }
  }

  &.is-one {
    background: $line-soft;
    border: 1PX solid $ink-muted;

    i:first-child {
      background: $ink-secondary;
    }
  }

  &.is-none {
    background: $surface-sunken;
    border: 1PX dashed $line-strong;
  }
}

.progress {
  height: 4PX;
  overflow: hidden;
  background: $surface-sunken;
  border-radius: 999PX;
}

.progress-fill {
  display: block;
  height: 100%;
  background: $brand-action;
  border-radius: 999PX;
  transition: width $motion-base $ease-standard;
}

.progress-text {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.todo-list {
  display: flex;
  flex-direction: column;
  margin-top: 8PX;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8PX;
  padding: 4PX 0;
  border-top: 1PX solid $line-soft;

  &:first-child {
    border-top: none;
  }
}

.todo-check {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44PX;
  height: 44PX;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: -4PX;
    border-radius: 12PX;
  }
}

.todo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20PX;
  height: 20PX;
  color: #fff;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 6PX;

  .todo-item.is-done & {
    background: $brand-action;
    border-color: $brand-action;
  }
}

.todo-text {
  flex: 1;
  min-width: 0;
  padding: 8PX 0;
}

.todo-title {
  font-size: 14PX;
  line-height: 1.5;
  color: $ink;
  overflow-wrap: anywhere;

  .todo-item.is-done & {
    color: $ink-muted;
  }
}

.todo-date {
  margin-top: 2PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.icon-link {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44PX;
  height: 44PX;
  color: $ink-muted;
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    color: $danger-text;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: -4PX;
    border-radius: 12PX;
  }
}

.wish-list {
  display: flex;
  flex-direction: column;
  gap: 8PX;
}

.wish-item {
  padding: 10PX 12PX;
  background: $bg-warm;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.wish-head {
  display: flex;
  align-items: center;
  gap: 6PX;
}

.wish-from {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12PX;
  color: $ink-muted;
}

.wish-status {
  flex: none;
  padding: 1PX 8PX;
  font-size: 12PX;
  line-height: 18PX;
  border-radius: 999PX;

  &.status-open {
    color: $ink-secondary;
    background: $surface;
    border: 1PX solid $line;
  }

  &.status-accepted {
    color: $success-text;
    background: $success-tint;
  }

  &.status-declined {
    color: $warning-text;
    background: $warning-tint;
  }
}

.wish-content {
  margin-top: 6PX;
  font-size: 14PX;
  line-height: 1.5;
  color: $ink;
  overflow-wrap: anywhere;
}

.wish-actions {
  display: flex;
  gap: 8PX;
  margin-top: 8PX;

  .btn {
    flex: 1;
    min-height: 44PX;
  }
}

.wish-meta {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 6PX;
  margin-top: 8PX;
  padding: 8PX 10PX;
  background: $surface;
  border: 1PX solid $line-soft;
  border-radius: 10PX;
}

.reply-item {
  display: flex;
  flex-direction: column;
  gap: 2PX;
}

.reply-author {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.reply-content {
  font-size: 13PX;
  line-height: 1.6;
  color: $ink;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  min-height: 44PX;
  padding: 0 2PX;
  font-size: 13PX;
  color: $brand-action;
  background: transparent;
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
    border-radius: 6PX;
  }
}

.reply-toggle {
  margin-top: 4PX;
}

.reply-form {
  display: flex;
  flex-direction: column;
  gap: 8PX;
  margin-top: 4PX;
}

.reply-from {
  display: flex;
  gap: 6PX;
}

.pick.is-small {
  min-width: 44PX;
  padding: 0 8PX;
  font-size: 12PX;
}

.textarea {
  flex: none;
  width: 100%;
  min-height: 84PX;
  padding: 10PX 12PX;
  line-height: 1.5;
  resize: vertical;
}

.reply-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8PX;
}

.reply-count {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
  font-variant-numeric: tabular-nums;
}

.empty-line {
  font-size: 14PX;
  line-height: 1.5;
  color: $ink-muted;
}

.add-form {
  display: flex;
  gap: 8PX;
  margin-top: 12PX;
}

.wish-from-pick {
  display: flex;
  flex: none;
  gap: 6PX;
}

.pick {
  min-height: 44PX;
  min-width: 48PX;
  padding: 0 10PX;
  font-size: 13PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;

  &.is-active {
    color: $ink;
    background: $accent-soft;
    border-color: $accent-line;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.input {
  flex: 1;
  min-width: 0;
  min-height: 44PX;
  padding: 10PX 12PX;
  font-size: 16PX;
  color: $ink;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;

  &::placeholder {
    font-size: 14PX;
    color: $placeholder;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &[aria-invalid='true'] {
    border-color: $danger-text;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.btn-primary {
  flex: none;
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;
}

.btn-ghost {
  color: $ink-secondary;
  background: $surface;
}

.error-text {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $danger-text;
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
</style>
