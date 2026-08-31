<script setup lang="ts">
// 购物车面板：清空 / 明细编辑 / 去结算
import { showConfirmDialog } from 'vant'
import { useCartStore } from '@/stores/cart'
import { formatPrice } from '@/utils/format'

const props = defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'checkout'): void
}>()

const cart = useCartStore()

function close() {
  emit('update:visible', false)
}

// 清空购物车（二次确认）
function onClear() {
  showConfirmDialog({
    title: '清空购物车',
    message: '确定要清空所有已选菜品吗？',
  })
    .then(() => cart.clear())
    .catch(() => undefined)
}

function onCheckout() {
  close()
  emit('checkout')
}
</script>

<template>
  <van-popup
    :show="props.visible"
    position="bottom"
    round
    :style="{ borderRadius: '20px 20px 0 0' }"
    @update:show="(v: boolean) => emit('update:visible', v)"
  >
    <div class="cart-panel">
      <div class="head">
        <span class="title">购物车</span>
        <span v-if="cart.items.length" class="clear press" @click="onClear">
          <van-icon name="delete-o" /> 清空
        </span>
      </div>

      <div v-if="cart.items.length" class="list">
        <div v-for="item in cart.items" :key="`${item.dishId}-${item.spec}`" class="item">
          <van-image :src="item.image_url" fit="cover" width="64" height="64" radius="8" lazy-load />
          <div class="info">
            <div class="name">{{ item.name }}</div>
            <div v-if="item.spec" class="spec hint-text">{{ item.spec }}</div>
            <div class="bottom">
              <span class="price price-text">¥{{ formatPrice(item.unitPrice) }}</span>
              <van-stepper
                :model-value="item.qty"
                :min="1"
                :max="99"
                integer
                @change="(v: string | number) => cart.updateQty(item.dishId, item.spec, Number(v))"
              />
            </div>
          </div>
          <van-icon class="del press" name="cross" color="#c8c9cc" @click="cart.remove(item.dishId, item.spec)" />
        </div>
      </div>

      <van-empty v-else description="购物车空空如也，去挑点好吃的吧~" />

      <div v-if="cart.items.length" class="footer safe-bottom">
        <div class="total price-text">¥{{ formatPrice(cart.totalPrice) }}</div>
        <button class="checkout-btn press" @click="onCheckout">去结算</button>
      </div>
    </div>
  </van-popup>
</template>

<style lang="scss" scoped>
.cart-panel {
  max-height: 65vh;
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;

  .title {
    font-size: 18px;
    font-weight: $font-bold;
  }

  .clear {
    font-size: $font-sm;
    color: $text-hint;

    .van-icon {
      vertical-align: -1px;
    }
  }
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;

  & + .item {
    border-top: 1px solid $border;
  }

  .info {
    flex: 1;
    min-width: 0;

    .name {
      font-size: $font-md;
      font-weight: $font-medium;
    }

    .spec {
      margin-top: 2px;
    }

    .bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
    }
  }

  .del {
    padding: 4px;
  }
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  box-shadow: $shadow-popup;

  .total {
    font-size: 22px;
  }

  .checkout-btn {
    min-width: 140px;
    height: 40px;
    border: none;
    border-radius: $radius-full;
    background: $primary-gradient;
    color: #fff;
    font-size: $font-md;
    font-weight: $font-medium;
  }
}
</style>
