<script setup lang="ts">
// 未回应约定的「弹幕」：横向飘过、错峰出现、可暂停/关闭，减少动态时改为静态列表
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CoupleProfile, CoupleWish } from '@/api/couple'

const props = defineProps<{
  wishes: CoupleWish[]
  profiles: CoupleProfile[]
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
}>()

const LANES = 2
const MAX_ITEMS = 8

const closed = ref(false)
const paused = ref(false)
const reduced = ref(false)
let media: MediaQueryList | null = null

// 只展示还没被回应、也还没有文字回复的约定
const pending = computed(() =>
  props.wishes.filter((item) => item.status === 'open' && item.replies.length === 0)
)

function nameOf(slot: 1 | 2): string {
  const profile = props.profiles.find((item) => item.slot === slot)
  return profile?.displayName || (slot === 1 ? '我' : 'TA')
}

// 每条只出现一次（不做无限循环），避免同一条反复刷屏。
// 同一泳道内把多条排成一组一起横向漂移：组内间距固定，永远不会互相压住；
// 两条泳道用不同的负延迟错峰，页面一打开就能看到内容而不是空白。
const shown = computed(() => pending.value.slice(0, MAX_ITEMS))

const lanes = computed(() => {
  const groups: CoupleWish[][] = Array.from({ length: LANES }, () => [])
  shown.value.forEach((wish, index) => groups[index % LANES].push(wish))
  return groups
    .map((items, lane) => {
      if (!items.length) return null
      // 组越宽走得越久，横向速度保持在同一量级（约 55 PX/s）
      const duration = 9 + items.length * 4.5
      const delay = -(duration * (lane === 0 ? 0.12 : 0.3))
      return {
        lane,
        items,
        style: {
          '--lane': String(lane),
          '--dur': `${duration}s`,
          '--delay': `${delay.toFixed(2)}s`,
        } as Record<string, string>,
      }
    })
    .filter((group): group is { lane: number; items: CoupleWish[]; style: Record<string, string> } =>
      Boolean(group)
    )
})

function onMedia(event: MediaQueryListEvent): void {
  reduced.value = event.matches
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced.value = media.matches
  media.addEventListener('change', onMedia)
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', onMedia)
})
</script>

<template>
  <section v-if="pending.length" class="danmaku" aria-labelledby="danmaku-title">
    <div class="dm-bar">
      <h2 id="danmaku-title" class="dm-heading">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6.5h16M4 12h10M4 17.5h13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        {{ pending.length }} 个小约定在等你回应
      </h2>
      <div class="dm-tools">
        <button v-if="!reduced" type="button" class="dm-tool" :aria-pressed="paused" @click="paused = !paused">
          {{ paused ? '继续' : '暂停' }}
        </button>
        <button type="button" class="dm-tool" aria-label="关闭弹幕" @click="closed = true">关闭</button>
      </div>
    </div>

    <div v-if="!closed" class="dm-stage" :class="{ 'is-paused': paused, 'is-static': reduced }">
      <template v-if="!reduced">
        <div v-for="group in lanes" :key="group.lane" class="dm-track" :style="group.style">
          <button
            v-for="wish in group.items"
            :key="wish.id"
            type="button"
            class="dm-pill"
            :aria-label="`来自${nameOf(wish.fromSlot)}的小约定：${wish.content}，点击去回复`"
            @click="emit('select', wish.id)"
          >
            <span class="dm-from">{{ nameOf(wish.fromSlot) }}</span>
            <span class="dm-text">{{ wish.content }}</span>
            <span class="dm-cta" aria-hidden="true">去回复</span>
          </button>
        </div>
      </template>
      <div v-else class="dm-static">
        <button
          v-for="wish in shown"
          :key="wish.id"
          type="button"
          class="dm-pill is-paused"
          @click="emit('select', wish.id)"
        >
          <span class="dm-from">{{ nameOf(wish.fromSlot) }}</span>
          <span class="dm-text">{{ wish.content }}</span>
          <span class="dm-cta" aria-hidden="true">去回复</span>
        </button>
      </div>
    </div>

    <button v-else type="button" class="dm-reopen" @click="closed = false">
      展开 {{ pending.length }} 个等你回应的小约定
    </button>
  </section>
</template>

<style scoped lang="scss">
.danmaku {
  margin-bottom: 10PX;
  padding: 10PX 12PX 8PX;
  background: $bg-warm;
  border: 1PX solid $line;
  border-radius: 16PX;
}

.dm-bar {
  display: flex;
  align-items: center;
  gap: 8PX;
}

.dm-heading {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6PX;
  font-size: 12PX;
  font-weight: 500;
  line-height: 1.5;
  color: $ink-muted;

  svg {
    flex: none;
    color: $accent-line;
  }
}

.dm-tools {
  display: flex;
  gap: 4PX;
}

.dm-tool {
  min-width: 44PX;
  min-height: 44PX;
  padding: 0 8PX;
  font-size: 12PX;
  color: $ink-secondary;
  background: transparent;
  border: none;
  border-radius: 10PX;
  cursor: pointer;

  &:hover {
    background: $surface;
    color: $ink;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: -2PX;
  }
}

.dm-stage {
  position: relative;
  height: 96PX;
  margin: 4PX -12PX 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 20PX, #000 calc(100% - 20PX), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 20PX, #000 calc(100% - 20PX), transparent 100%);
}

.dm-track {
  position: absolute;
  top: calc(var(--lane) * 48PX);
  left: 100%;
  display: flex;
  gap: 12PX;
  width: max-content;
  animation: dm-drift var(--dur) linear var(--delay) 1 both;
  will-change: transform;
}

.dm-stage.is-paused .dm-track {
  animation-play-state: paused;
}

// 位移距离 = 自身宽度 + 舞台宽度：手机上取视口宽度，桌面上容器更窄，取 600PX 封顶，
// 避免 1440 下位移过长导致速度突然变快。
@keyframes dm-drift {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(calc(-100% - min(100vw, 600PX)), 0, 0);
  }
}

.dm-pill {
  display: inline-flex;
  align-items: center;
  gap: 8PX;
  max-width: 300PX;
  min-height: 44PX;
  padding: 0 12PX 0 10PX;
  font-size: 13PX;
  line-height: 1.4;
  color: $ink;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 999PX;
  box-shadow: $shadow-sm;
  cursor: pointer;

  &.is-paused {
    max-width: none;
  }

  &:hover {
    border-color: $line-strong;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.dm-from {
  flex: none;
  padding: 1PX 6PX;
  font-size: 12PX;
  color: $ink-muted;
  background: $line-soft;
  border-radius: 999PX;
}

.dm-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dm-cta {
  flex: none;
  font-size: 12PX;
  color: $brand-action;
}

.dm-static {
  display: flex;
  flex-wrap: wrap;
  gap: 8PX;
  max-height: 164PX;
  padding: 0 12PX;
  overflow-y: auto;
}

.dm-reopen {
  width: 100%;
  min-height: 44PX;
  margin-top: 4PX;
  font-size: 13PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX dashed $line-strong;
  border-radius: 12PX;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dm-track {
    animation: none;
    transform: translate3d(0, 0, 0);
  }
}
</style>
