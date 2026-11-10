<script setup lang="ts">
// 某一天的双人打卡详情：两个人各自的状态/心情/描述 + 给对方点赞
import { computed, ref, watch } from 'vue'
import { Popup, showToast } from 'vant'
import {
  CoupleApiError,
  coupleApi,
  type CheckinDayEntry,
  type CoupleProfile,
} from '@/api/couple'
import { moodLabel, setViewerSlot, viewerSlot } from '../mood'

const props = defineProps<{
  show: boolean
  day: string
  profiles: CoupleProfile[]
}>()

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
}>()

const entries = ref<CheckinDayEntry[]>([])
const loading = ref(false)
const error = ref('')
const likeBusy = ref<1 | 2 | null>(null)

function errorMessage(err: unknown): string {
  if (err instanceof CoupleApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return '操作失败，请稍后重试'
}

function nameOf(slot: 1 | 2): string {
  const profile = props.profiles.find((item) => item.slot === slot)
  return profile?.displayName || (slot === 1 ? '我' : 'TA')
}

function avatarOf(slot: 1 | 2): string {
  return props.profiles.find((item) => item.slot === slot)?.avatarUrl || ''
}

function timeOf(raw: string | null): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const dayLabel = computed(() => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.day)
  if (!matched) return props.day
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${Number(matched[1])} 年 ${Number(matched[2])} 月 ${Number(matched[3])} 日 · 周${week}`
})

const count = computed(() => entries.value.filter((item) => item.done).length)
const stateKey = computed(() => (count.value === 2 ? 'both' : count.value === 1 ? 'one' : 'none'))
const stateText = computed(() =>
  count.value === 2 ? '两个人都打卡了' : count.value === 1 ? '只有一人打卡' : '这天没人打卡'
)
const stateHint = computed(() =>
  count.value === 2 ? '这一天被你们一起记住了' : count.value === 1 ? '另一个人这天还没打卡' : '这天还没有留下记录'
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const detail = await coupleApi.checkinDay(props.day)
    entries.value = detail.entries
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.show, props.day] as const,
  ([show]) => {
    if (show) load()
  },
  { immediate: true }
)

function likedByMe(entry: CheckinDayEntry): boolean {
  return entry.likes.includes(viewerSlot.value)
}

async function toggleLike(entry: CheckinDayEntry): Promise<void> {
  if (likeBusy.value || !entry.done) return
  if (entry.slot === viewerSlot.value) {
    showToast('这是你自己的打卡，去给对方点一个吧')
    return
  }
  likeBusy.value = entry.slot
  try {
    const result = await coupleApi.toggleCheckinLike(props.day, entry.slot, viewerSlot.value)
    entries.value = entries.value.map((item) => (item.slot === entry.slot ? { ...item, likes: result.entry.likes } : item))
  } catch (err) {
    showToast(errorMessage(err))
  } finally {
    likeBusy.value = null
  }
}

function switchViewer(): void {
  setViewerSlot(viewerSlot.value === 1 ? 2 : 1)
}
</script>

<template>
  <Popup
    :show="show"
    position="bottom"
    round
    teleport="body"
    class="couple-sheet day-sheet"
    safe-area-inset-bottom
    :style="{ maxHeight: '82vh' }"
    close-on-click-overlay
    @update:show="emit('update:show', $event)"
  >
    <div class="sheet-head">
      <p class="sheet-date">{{ dayLabel }}</p>

      <!-- 三种状态用图形区分：双圆实心 / 单圆描边 / 虚线空心 -->
      <div class="state-badge" :class="`is-${stateKey}`">
        <span class="state-mark" aria-hidden="true">
          <i class="state-dot dot-a" />
          <i class="state-dot dot-b" />
        </span>
        <span class="state-text">{{ stateText }}</span>
      </div>
      <p class="sheet-sub">{{ stateHint }}</p>

      <div class="viewer-row">
        <span class="viewer-label">以「{{ nameOf(viewerSlot) }}」的身份点赞</span>
        <button type="button" class="viewer-switch" @click="switchViewer">切换成 {{ nameOf(viewerSlot === 1 ? 2 : 1) }}</button>
      </div>
    </div>

    <div class="sheet-body">
      <p v-if="loading" class="empty-line">正在读取这一天的记录…</p>
      <p v-else-if="error" class="error-text" role="alert">{{ error }}</p>

      <template v-else>
        <article
          v-for="entry in entries"
          :key="entry.slot"
          class="entry"
          :class="{ 'is-missing': !entry.done, 'is-self': entry.slot === viewerSlot }"
        >
          <header class="entry-head">
            <span class="entry-avatar" aria-hidden="true">
              <img v-if="avatarOf(entry.slot)" :src="avatarOf(entry.slot)" alt="" />
              <svg v-else viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" fill="#FBF1EA" stroke="#E7D3C5" stroke-width="1.5" />
                <circle cx="32" cy="26" r="9" fill="#D9C7B8" />
                <path d="M14 54c2-9.5 9-14.5 18-14.5s16 5 18 14.5" fill="#D9C7B8" />
              </svg>
            </span>
            <div class="entry-title">
              <p class="entry-name">{{ nameOf(entry.slot) }}</p>
              <p class="entry-time">
                {{ entry.done ? `已打卡 · ${timeOf(entry.time)}` : '这天没有打卡' }}
              </p>
            </div>
            <span v-if="entry.done" class="entry-mood">{{ moodLabel(entry.mood) || '未选心情' }}</span>
          </header>

          <template v-if="entry.done">
            <p v-if="entry.moodText" class="entry-mood-text">{{ entry.moodText }}</p>
            <p v-if="entry.note" class="entry-note">{{ entry.note }}</p>
            <p v-else class="entry-empty">没有写描述，只留下了一次打卡。</p>

            <div class="entry-foot">
              <button
                type="button"
                class="like-btn"
                :class="{ 'is-liked': likedByMe(entry), 'is-disabled': entry.slot === viewerSlot }"
                :aria-pressed="likedByMe(entry)"
                :aria-label="`${likedByMe(entry) ? '取消点赞' : '点赞'}：${nameOf(entry.slot)} 的打卡，当前 ${entry.likes.length} 个赞`"
                :disabled="likeBusy === entry.slot"
                @click="toggleLike(entry)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 20.2S4.6 15.8 4.6 10.9A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.4 3.5c0 4.9-7.4 9.3-7.4 9.3Z"
                    :fill="likedByMe(entry) ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>{{ entry.likes.length ? `${entry.likes.length} 个赞` : '点赞' }}</span>
              </button>
              <span v-if="entry.slot === viewerSlot" class="like-hint">这是你的打卡</span>
              <span v-else-if="entry.likes.length" class="like-hint">
                {{ entry.likes.map((slot) => nameOf(slot === 2 ? 2 : 1)).join('、') }} 赞过
              </span>
            </div>
          </template>
        </article>
      </template>
    </div>
  </Popup>
</template>

<style scoped lang="scss">
.sheet-head {
  padding: 20PX 20PX 0;
}

.sheet-date {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  gap: 8PX;
  margin-top: 8PX;
  padding: 6PX 12PX 6PX 8PX;
  border-radius: 999PX;
  border: 1PX solid $line;

  &.is-both {
    color: $ink;
    background: $accent-soft;
    border-color: $accent-line;
  }

  &.is-one {
    color: $ink-secondary;
    background: $line-soft;
    border-color: $line;
  }

  &.is-none {
    color: $ink-muted;
    background: transparent;
    border-style: dashed;
  }
}

.state-mark {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30PX;
  height: 18PX;
}

.state-dot {
  position: absolute;
  top: 50%;
  width: 12PX;
  height: 12PX;
  margin-top: -6PX;
  border-radius: 50%;
}

.dot-a {
  left: 2PX;
}

.dot-b {
  left: 12PX;
}

.is-both .state-dot {
  background: $brand-action;
  border: 1PX solid $brand-action;
}

.is-one .dot-a {
  background: $surface;
  border: 1.5PX solid $ink-muted;
}

.is-one .dot-b {
  background: transparent;
  border: 1PX dashed $line-strong;
}

.is-none .state-dot {
  background: transparent;
  border: 1PX dashed $line-strong;
}

.state-text {
  font-size: 13PX;
  font-weight: 600;
  line-height: 1.4;
}

.sheet-sub {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.viewer-row {
  display: flex;
  align-items: center;
  gap: 8PX;
  margin-top: 14PX;
  padding-top: 12PX;
  border-top: 1PX solid $line-soft;
}

.viewer-label {
  flex: 1;
  min-width: 0;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.viewer-switch {
  flex: none;
  min-height: 44PX;
  padding: 0 12PX;
  font-size: 13PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 10PX;
  padding: 12PX 20PX calc(20PX + env(safe-area-inset-bottom));
}

.entry {
  padding: 12PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 14PX;

  &.is-self {
    background: $bg-warm;
  }

  &.is-missing {
    border-style: dashed;
    background: transparent;
  }
}

.entry-head {
  display: flex;
  align-items: center;
  gap: 10PX;
}

.entry-avatar {
  flex: none;
  width: 36PX;
  height: 36PX;
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

.entry-title {
  flex: 1;
  min-width: 0;
}

.entry-name {
  font-size: 14PX;
  font-weight: 600;
  line-height: 1.4;
  color: $ink;
}

.entry-time {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.entry-mood {
  flex: none;
  padding: 3PX 10PX;
  font-size: 12PX;
  line-height: 18PX;
  color: $ink-secondary;
  background: $line-soft;
  border-radius: 999PX;
}

.entry-mood-text {
  margin-top: 10PX;
  font-size: 14PX;
  line-height: 1.6;
  color: $ink;
  overflow-wrap: anywhere;
}

.entry-note {
  margin-top: 6PX;
  font-size: 13PX;
  line-height: 1.6;
  color: $ink-secondary;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.entry-empty {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.entry-foot {
  display: flex;
  align-items: center;
  gap: 8PX;
  margin-top: 10PX;
  padding-top: 10PX;
  border-top: 1PX solid $line-soft;
}

.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 6PX;
  min-height: 44PX;
  padding: 0 14PX;
  font-size: 13PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 999PX;
  cursor: pointer;

  &.is-liked {
    color: $danger-text;
    background: $danger-tint;
    border-color: $danger-tint;
  }

  &.is-disabled {
    color: $ink-muted;
    background: $surface-sunken;
    border-color: $line-soft;
    cursor: not-allowed;
  }

  &:disabled {
    opacity: 0.7;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.like-hint {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.empty-line {
  font-size: 14PX;
  line-height: 1.5;
  color: $ink-muted;
}

.error-text {
  font-size: 12PX;
  line-height: 1.5;
  color: $danger-text;
}
</style>
