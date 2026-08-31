<script setup lang="ts">
// 订单状态标签：颜色映射 + 制作中脉冲动画
import { computed } from 'vue'
import type { OrderStatus } from '@/api/types'

const props = defineProps<{ status: OrderStatus }>()

const MAP: Record<OrderStatus, { text: string; color: string }> = {
  pending_pay: { text: '待支付', color: '#FF6B35' },
  preparing: { text: '制作中', color: '#1989FA' },
  ready: { text: '待取餐', color: '#07C160' },
  completed: { text: '已完成', color: '#999999' },
  cancelled: { text: '已取消', color: '#EE0A24' },
}

const info = computed(() => MAP[props.status] || { text: '', color: '#999' })
</script>

<template>
  <span class="status-tag" :class="{ pulsing: status === 'preparing' }" :style="{ background: info.color }">
    {{ info.text }}
  </span>
</template>

<style lang="scss" scoped>
.status-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: $radius-sm;
  color: #fff;
  font-size: $font-xs;
  line-height: 1.4;
  white-space: nowrap;
}

.pulsing {
  animation: pulse 1.5s ease-in-out infinite;
}
</style>
