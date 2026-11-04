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
        <img v-if="photoSrc" :src="photoSrc" alt="零食照片" loading="lazy" />
        <span v-else class="thumb-placeholder">🍪</span>
      </div>

      <div class="info">
        <div class="title-row">
          <h3 class="name">{{ item.name }}</h3>
          <span class="qty">×{{ item.quantity }}</span>
        </div>
        <p v-if="item.brand" class="brand">{{ item.brand }}</p>
        <p class="expire">到期日 {{ item.expireDate }}</p>
        <p class="countdown">
          <span class="dot" />
          {{ countdownText }}
        </p>
        <p v-if="item.note" class="note">{{ item.note }}</p>
      </div>

      <span class="status-tag">{{ statusLabel }}</span>
    </div>

    <div class="card-actions">
      <button class="action" @click="emit('edit', item)">编辑</button>
      <button class="action" @click="emit('toggle-finish', item)">
        {{ item.finished ? '取消归档' : '已吃完' }}
      </button>
      <button class="action danger" @click="emit('remove', item)">删除</button>
    </div>
  </article>
</template>

<style scoped lang="scss">
.snack-card {
  position: relative;
  padding: 12px;
  background: $bg-card;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  border-left: 4px solid transparent;

  &.normal {
    border-left-color: $success;
  }

  &.near {
    border-left-color: $warning;
  }

  &.expired {
    border-left-color: $danger;
  }

  &.finished {
    border-left-color: #c8c9cc;
  }
}

.card-main {
  display: flex;
  gap: 12px;
}

.thumb {
  flex: none;
  width: 78px;
  height: 78px;
  border-radius: 10px;
  overflow: hidden;
  background: #f7f8fa;
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
  font-size: 32px;
  opacity: 0.6;
}

.finished .thumb img {
  filter: grayscale(1);
  opacity: 0.7;
}

.info {
  flex: 1;
  min-width: 0;
  padding-right: 52px;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.name {
  font-size: $font-md;
  font-weight: $font-bold;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty {
  flex: none;
  font-size: $font-sm;
  color: $text-secondary;
}

.brand {
  margin-top: 3px;
  font-size: $font-xs;
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expire {
  margin-top: 6px;
  font-size: $font-xs;
  color: $text-hint;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: $font-sm;
  font-weight: $font-medium;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.normal .countdown {
  color: $success;
}

.near .countdown {
  color: #e69200;
}

.expired .countdown {
  color: $danger;
}

.finished .countdown {
  color: $text-hint;
}

.note {
  margin-top: 6px;
  font-size: $font-xs;
  color: $text-secondary;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 6px;
  line-height: 14px;
  white-space: nowrap;
}

.normal .status-tag {
  color: $success;
  background: rgba(7, 193, 96, 0.1);
}

.near .status-tag {
  color: #d48806;
  background: rgba(255, 193, 7, 0.18);
}

.expired .status-tag {
  color: $danger;
  background: rgba(238, 10, 36, 0.1);
}

.finished .status-tag {
  color: $text-hint;
  background: #f2f3f5;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed $border;
}

.action {
  padding: 5px 12px;
  font-size: $font-xs;
  color: $text-secondary;
  background: #f7f8fa;
  border: none;
  border-radius: $radius-full;
  transition: background 150ms ease;

  &:active {
    background: #ebedf0;
  }

  &.danger {
    color: $danger;
    background: rgba(238, 10, 36, 0.06);
  }
}
</style>
