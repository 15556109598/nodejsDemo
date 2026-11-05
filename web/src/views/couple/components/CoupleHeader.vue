<script setup lang="ts">
// 顶部双人头像区：头像 / 名字 / 一行状态 / 更新时间，中间一条细连接线
import { computed, reactive, ref } from 'vue'
import type { CoupleProfile } from '@/api/couple'
import ProfileSheet from './ProfileSheet.vue'

const props = defineProps<{
  profiles: CoupleProfile[]
  today: string
}>()

const emit = defineEmits<{
  (event: 'updated', profile: CoupleProfile): void
}>()

const sheetOpen = ref(false)
const activeSlot = ref<1 | 2>(1)
const failed = reactive<Record<number, boolean>>({ 1: false, 2: false })

function profileFor(slot: 1 | 2): CoupleProfile | null {
  return props.profiles.find((item) => item.slot === slot) || null
}

const activeProfile = computed(() => profileFor(activeSlot.value))

const left = computed(() => profileFor(1))
const right = computed(() => profileFor(2))

function openSheet(slot: 1 | 2): void {
  activeSlot.value = slot
  sheetOpen.value = true
}

function nameOf(profile: CoupleProfile | null): string {
  return profile?.displayName || (profile?.slot === 1 ? '我' : 'TA')
}

function statusOf(profile: CoupleProfile | null): string {
  return profile?.statusText || '点一下设置状态'
}

function timeText(profile: CoupleProfile | null): string {
  if (!profile?.statusUpdatedAt) return '还没有设置状态'
  const date = new Date(profile.statusUpdatedAt)
  if (Number.isNaN(date.getTime())) return ''
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) return `今天 ${hm}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return `昨天 ${hm}`
  }
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${hm}`
}

function onUpdated(profile: CoupleProfile): void {
  failed[profile.slot] = false
  emit('updated', profile)
}
</script>

<template>
  <section class="people" aria-label="我们两个人的近况">
    <div class="person">
      <button
        type="button"
        class="avatar-btn"
        :aria-label="`设置 ${nameOf(left)} 的头像与状态`"
        @click="openSheet(1)"
      >
        <img
          v-if="left?.avatarUrl && !failed[1]"
          :src="left.avatarUrl"
          :alt="`${nameOf(left)}的头像`"
          @error="failed[1] = true"
        />
        <svg v-else viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#FBF1EA" stroke="#E7D3C5" stroke-width="1.5" />
          <circle cx="32" cy="26" r="9" fill="#D9C7B8" />
          <path d="M14 54c2-9.5 9-14.5 18-14.5s16 5 18 14.5" fill="#D9C7B8" />
        </svg>
      </button>
      <p class="person-name">{{ nameOf(left) }}</p>
      <button type="button" class="status-btn" :aria-label="`设置 ${nameOf(left)} 的状态`" @click="openSheet(1)">
        <span class="status-pill" :class="{ 'is-empty': !left?.statusText }">{{ statusOf(left) }}</span>
      </button>
      <p class="person-time">{{ timeText(left) }}</p>
    </div>

    <div class="connector" aria-hidden="true">
      <span class="connector-line" />
      <svg class="connector-heart" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 20s-7.2-4.4-7.2-9.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.2 3.4C19.2 15.6 12 20 12 20Z"
          stroke="#C2410C"
          stroke-width="1.4"
        />
      </svg>
      <span class="connector-line" />
    </div>

    <div class="person">
      <button
        type="button"
        class="avatar-btn"
        :aria-label="`设置 ${nameOf(right)} 的头像与状态`"
        @click="openSheet(2)"
      >
        <img
          v-if="right?.avatarUrl && !failed[2]"
          :src="right.avatarUrl"
          :alt="`${nameOf(right)}的头像`"
          @error="failed[2] = true"
        />
        <svg v-else viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#FBF1EA" stroke="#E7D3C5" stroke-width="1.5" />
          <circle cx="32" cy="26" r="9" fill="#D9C7B8" />
          <path d="M14 54c2-9.5 9-14.5 18-14.5s16 5 18 14.5" fill="#D9C7B8" />
        </svg>
      </button>
      <p class="person-name">{{ nameOf(right) }}</p>
      <button type="button" class="status-btn" :aria-label="`设置 ${nameOf(right)} 的状态`" @click="openSheet(2)">
        <span class="status-pill" :class="{ 'is-empty': !right?.statusText }">{{ statusOf(right) }}</span>
      </button>
      <p class="person-time">{{ timeText(right) }}</p>
    </div>

    <ProfileSheet
      v-model:show="sheetOpen"
      :profile="activeProfile"
      :today="today"
      @updated="onUpdated"
    />
  </section>
</template>

<style scoped lang="scss">
.people {
  display: flex;
  align-items: flex-start;
  gap: 8PX;
  margin-bottom: 12PX;
  padding: 16PX 12PX 12PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;
}

.person {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-btn {
  width: 64PX;
  height: 64PX;
  padding: 0;
  overflow: hidden;
  background: $surface-sunken;
  border: 1PX solid $line;
  border-radius: 50%;
  cursor: pointer;
  transition: border-color $motion-fast $ease-standard;

  &:hover {
    border-color: $line-strong;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.person-name {
  margin-top: 8PX;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14PX;
  font-weight: 600;
  line-height: 1.4;
  color: $ink;
}

.status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44PX;
  padding: 0 2PX;
  background: transparent;
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: -2PX;
    border-radius: 12PX;
  }
}

.status-pill {
  display: inline-block;
  max-width: 100%;
  padding: 3PX 10PX;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12PX;
  line-height: 18PX;
  color: $ink-secondary;
  background: $accent-soft;
  border: 1PX solid $accent-line;
  border-radius: 999PX;

  &.is-empty {
    color: $ink-muted;
    background: $line-soft;
    border-color: $line;
  }
}

.person-time {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12PX;
  line-height: 1.4;
  color: $ink-muted;
}

.connector {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6PX;
  padding-top: 15PX;
}

.connector-line {
  width: 1PX;
  height: 16PX;
  background: $accent-line;
}

.connector-heart {
  display: block;
}
</style>
