<script setup lang="ts">
// 底部悬浮购物车栏：图标角标（bounce）/ 已选 / 合计 / 去结算
import { ref, watch } from 'vue'
import { useCartStore } from '@/stores/cart'
import { formatPrice } from '@/utils/format'

const emit = defineEmits<{
  (e: 'open-panel'): void
  (e: 'checkout'): void
}>()

const cart = useCartStore()

const iconRef = ref<HTMLElement | null>(null)
const bouncing = ref(false)

// 角标数字增加时触发 bounce
watch(
  () => cart.totalQty,
  (val, old) => {
    if (val > old) {
      bouncing.value = false
      requestAnimationFrame(() => {
        bouncing.value = true
        window.setTimeout(() => (bouncing.value = false), 400)
      })
    }
  }
)

defineExpose({ iconEl: iconRef })
</script>

<template>
  <div class="cart-bar card">
    <!-- 左：购物车图标 -->
    <div ref="iconRef" class="icon-wrap press" @click="emit('open-panel')">
      <van-badge :content="cart.totalQty > 0 ? String(cart.totalQty) : ''" max="99">
        <div class="icon-circle" :class="{ bouncing }">
          <van-icon name="shopping-cart-o" size="24" color="#fff" />
        </div>
      </van-badge>
    </div>

    <!-- 中：已选 + 合计 -->
    <div class="summary" @click="emit('open-panel')">
      <div class="selected hint-text">已选 {{ cart.totalQty }} 件</div>
      <div class="total price-text">¥{{ formatPrice(cart.totalPrice) }}</div>
    </div>

    <!-- 右：去结算 -->
    <button class="checkout-btn press" :disabled="cart.totalQty === 0" @click="emit('checkout')">去结算</button>
  </div>
</template>

<style lang="scss" scoped>
.cart-bar {
  position: fixed;
  left: 16px;
  right: 16px;
  // 悬浮在 tabbar 之上
  bottom: calc(66px + env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 8px 8px 8px 12px;
  border-radius: $radius-full;
  box-shadow: $shadow-card;
}

.icon-wrap {
  flex-shrink: 0;
  // 图标凸出条体
  margin-top: -22px;

  .icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: $primary-gradient;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(255, 107, 53, 0.4);

    &.bouncing {
      animation: bounce 400ms ease;
    }
  }

  :deep(.van-badge) {
    position: absolute;
    top: -4px;
    right: -4px;
    z-index: 2;
  }
}

.summary {
  flex: 1;
  min-width: 0;
  margin-left: 10px;
  cursor: pointer;

  .total {
    font-size: 22px;
    line-height: 1.15;
  }
}

.checkout-btn {
  flex-shrink: 0;
  height: 40px;
  padding: 0 22px;
  border: none;
  border-radius: $radius-full;
  background: $primary-gradient;
  color: #fff;
  font-size: $font-md;
  font-weight: $font-medium;

  &:disabled {
    background: #e5e5e5;
    color: #fff;
  }
}
</style>
