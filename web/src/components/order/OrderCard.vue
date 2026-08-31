<script setup lang="ts">
// 订单卡片：门店头 + 状态标签 + 商品行 + 金额 + 操作按钮
import { computed } from 'vue'
import type { Order } from '@/api/types'
import StatusTag from './StatusTag.vue'
import OrderActions from './OrderActions.vue'
import { formatPrice } from '@/utils/format'

const props = defineProps<{ order: Order }>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'review', order: Order): void
}>()

// 总件数
const totalQty = computed(() => (props.order.items || []).reduce((s, i) => s + i.qty, 0))

// 实付 = 商品总价 - 积分抵扣（10 积分 = 1 元）
const paid = computed(() => Math.max(0, Math.round((props.order.total - props.order.points_used / 10) * 100) / 100))

// 明细行（最多展示 2 行 + 折叠提示）
const visibleItems = computed(() => (props.order.items || []).slice(0, 2))
const hiddenCount = computed(() => Math.max(0, (props.order.items || []).length - 2))
</script>

<template>
  <div class="order-card card">
    <!-- 头部 -->
    <div class="head">
      <div class="shop">
        <van-icon name="shop-o" size="16" />
        <span class="shop-name">小厨·现炒（堂食）</span>
        <van-icon name="arrow" size="12" color="#c8c9cc" />
      </div>
      <StatusTag :status="order.status" />
    </div>

    <!-- 商品行 -->
    <div class="items" @click="hiddenCount > 0 ? undefined : undefined">
      <div v-for="it in visibleItems" :key="it.id" class="item-row">
        <van-image :src="it.image_url" fit="cover" width="40" height="40" radius="8" lazy-load />
        <div class="item-info">
          <div class="item-name">{{ it.dish_name }}</div>
          <div v-if="it.spec" class="item-spec hint-text">{{ it.spec }}</div>
        </div>
        <div class="item-qty">x{{ it.qty }}</div>
      </div>
      <div v-if="hiddenCount > 0" class="more hint-text">...等 {{ totalQty }} 件商品</div>
    </div>

    <!-- 底部 -->
    <div class="foot">
      <div class="amount">
        <span class="hint-text">共 {{ totalQty }} 件</span>
        <span v-if="order.points_used > 0" class="points-tag">积分抵扣</span>
        <span class="paid-label">实付</span>
        <span class="paid price-text">¥{{ formatPrice(paid) }}</span>
      </div>
      <OrderActions :order="order" @refresh="emit('refresh')" @review="emit('review', order)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.order-card {
  padding: 12px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid $border;

  .shop {
    display: flex;
    align-items: center;
    gap: 4px;

    .shop-name {
      font-size: $font-md;
      font-weight: $font-medium;
      margin: 0 2px;
    }
  }
}

.items {
  padding: 10px 0;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 10px;

  & + .item-row {
    margin-top: 8px;
  }

  .item-info {
    flex: 1;
    min-width: 0;

    .item-name {
      font-size: $font-sm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .item-qty {
    font-size: $font-sm;
    color: $text-hint;
  }
}

.more {
  margin-top: 6px;
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid $border;

  .amount {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;

    .points-tag {
      font-size: $font-xs;
      color: $primary;
      background: rgba(255, 107, 53, 0.1);
      padding: 1px 6px;
      border-radius: $radius-sm;
    }

    .paid {
      font-size: 16px;
    }
  }
}
</style>
