<script setup lang="ts">
// 零食卡片：照片 + 信息 + 剩余天数倒计时 + 操作
import { computed } from 'vue'
import { resolveUploadUrl, type SnackItem } from '@/api/snacks'

const props = defineProps<{ item: SnackItem; nearDays: number }>()

const emit = defineEmits<{
  (e: 'edit', item: SnackItem): void
  (e: 'toggle-finish', item: SnackItem): void
  (e: 'remove', item: SnackItem): void
}>()

// 仅按日期比较（本地时区），避免时分秒导致差一天
function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d, 0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

const daysLeft = computed(() => daysUntil(props.item.expireDate))

// 状态：已吃完 / 已过期 / 临近过期 / 正常
const status = computed<'finished' | 'expired' | 'near' | 'normal'>(() => {
  if (props.item.finished) return 'finished'
  const d = daysLeft.value
  if (d < 0) return 'expired'
  if (d <= props.nearDays) return 'near'
  return 'normal'
})

const statusLabel = computed(
  () => ({ finished: '已吃完', expired: '已过期', near: '临近过期', normal: '保质期内' })[status.value]
)

const countdownText = computed(() => {
  if (props.item.finished) return '已吃完归档'
  const d = daysLeft.value
  if (d < 0) return `已过期 ${-d} 天`
  if (d === 0) return '今天到期'
  if (d <= props.nearDays) return `还剩 ${d} 天，${props.nearDays} 天内过期`
  return `还剩 ${d} 天`
})

const photoSrc = computed(() => resolveUploadUrl(props.item.photoUrl))
</script>

<template>
  <article class="snack-card" :class="status">
    <div class="card-main">
      <div class="thumb">
        <img v-if="photoSrc" :src="photoSrc" :alt="`${item.name} 的照片`" loading="lazy" />
        <span v-else class="thumb-placeholder" aria-hidden="true">🍪</span>
      </div>

      <div class="info">
        <div class="title-row">
          <h2 class="name">{{ item.name }}</h2>
          <span class="qty">×{{ item.quantity }}</span>
        </div>
        <p v-if="item.brand" class="brand">{{ item.brand }}</p>
        <p class="expire">到期日 {{ item.expireDate }}</p>
        <p class="countdown">
          <span class="dot" aria-hidden="true" />
          {{ countdownText }}
        </p>
        <p v-if="item.note" class="note">{{ item.note }}</p>
      </div>

      <span class="status-tag">{{ statusLabel }}</span>
    </div>

    <div class="card-actions">
      <button type="button" class="action" @click="emit('edit', item)">编辑</button>
      <button type="button" class="action" @click="emit('toggle-finish', item)">
        {{ item.finished ? '取消归档' : '已吃完' }}
      </button>
      <button type="button" class="action danger" @click="emit('remove', item)">删除</button>
    </div>
  </article>
</template>

<style scoped lang="scss">
// 与入口页一致：本组件使用大写 PX，避免桌面端被 px→vw 放大
.snack-card {
  position: relative;
  padding: 14PX;
  background: $surface;
  border: 1PX solid $line;
  border-left: 3PX solid $line;
  border-radius: 12PX;
  box-shadow: 0 1PX 2PX rgba(36, 31, 27, 0.04);

  &.normal {
    border-left-color: $success-text;
  }

  &.near {
    border-left-color: $warning-text;
  }

  &.expired {
    border-left-color: $danger-text;
  }

  &.finished {
    border-left-color: #a9a29b;
  }
}

.card-main {
  display: flex;
  gap: 12PX;
}

.thumb {
  flex: none;
  width: 76PX;
  height: 76PX;
  border-radius: 12PX;
  overflow: hidden;
  background: $line-soft;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.thumb-placeholder {
  font-size: 30PX;
  opacity: 0.7;
}

.finished .thumb img {
  filter: grayscale(1);
  opacity: 0.7;
}

.info {
  flex: 1;
  min-width: 0;
  padding-right: 66PX;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 6PX;
}

.name {
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.25;
  color: $ink;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty {
  flex: none;
  font-size: 13PX;
  color: $ink-secondary;
}

.brand {
  margin-top: 3PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expire {
  margin-top: 4PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 4PX;
  margin-top: 4PX;
  font-size: 13PX;
  font-weight: 500;
  line-height: 1.5;
}

.dot {
  width: 5PX;
  height: 5PX;
  border-radius: 50%;
  background: currentColor;
}

.normal .countdown {
  color: $success-text;
}

.near .countdown {
  color: $warning-text;
}

.expired .countdown {
  color: $danger-text;
}

.finished .countdown {
  color: $ink-muted;
}

.note {
  margin-top: 4PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-secondary;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status-tag {
  position: absolute;
  top: 14PX;
  right: 14PX;
  padding: 0 8PX;
  font-size: 12PX;
  line-height: 20PX;
  border-radius: 8PX;
  white-space: nowrap;
}

.normal .status-tag {
  color: $success-text;
  background: $success-tint;
}

.near .status-tag {
  color: $warning-text;
  background: $warning-tint;
}

.expired .status-tag {
  color: $danger-text;
  background: $danger-tint;
}

.finished .status-tag {
  color: $ink-muted;
  background: $muted-tint;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8PX;
  margin-top: 12PX;
  padding-top: 12PX;
  border-top: 1PX solid $line-soft;
}

.action {
  min-height: 44PX;
  padding: 0 14PX;
  font-size: 12PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;
  transition: background $motion-fast $ease-standard, border-color $motion-fast $ease-standard;

  &:active {
    background: $bg-warm;
  }

  &.danger {
    color: $danger-text;
    background: $danger-tint;
    border-color: #f2d6d9;

    &:active {
      background: #fbe2e4;
    }
  }
}
</style>
