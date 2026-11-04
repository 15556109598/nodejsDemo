<script setup lang="ts">
// 订单操作按钮组：按状态渲染（列表卡片与详情页共用）
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showConfirmDialog, showToast } from 'vant'
import { orderApi } from '@/api'
import type { Order } from '@/api/types'
import { useCartStore } from '@/stores/cart'

const props = defineProps<{ order: Order }>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'review', order: Order): void
}>()

const router = useRouter()
const cart = useCartStore()

const status = computed(() => props.order.status)

// 取消订单（二次确认）
function onCancel() {
  showConfirmDialog({
    title: '取消订单',
    message: '确定要取消该订单吗？已抵扣积分将退还。',
  })
    .then(async () => {
      await orderApi.cancel(props.order.id)
      showToast('订单已取消')
      emit('refresh')
    })
    .catch(() => undefined)
}

// 去支付
async function onPay() {
  await orderApi.pay(props.order.id)
  showToast('支付成功')
  emit('refresh')
}

// 取餐码弹窗（订单号后 6 位大字）
function onPickupCode() {
  showDialog({
    title: '取餐码',
    message: props.order.order_no.slice(-6),
    className: 'pickup-code-dialog',
    confirmButtonText: '知道了',
  }).catch(() => undefined)
}

// 确认取餐
async function onConfirm() {
  await orderApi.confirm(props.order.id)
  showToast('取餐成功，积分已到账')
  emit('refresh')
}

// 再来一单：明细逐个加回购物车
function onReorder() {
  for (const it of props.order.items || []) {
    cart.addItem({
      dishId: it.dish_id,
      name: it.dish_name,
      image_url: it.image_url,
      spec: it.spec,
      unitPrice: it.unit_price,
      qty: it.qty,
    })
  }
  showToast('已加入购物车')
  router.push('/app')
}
</script>

<template>
  <div class="order-actions">
    <!-- 待支付 -->
    <template v-if="status === 'pending_pay'">
      <button class="btn ghost press" @click="onCancel">取消订单</button>
      <button class="btn primary press" @click="onPay">去支付</button>
    </template>

    <!-- 制作中：无操作 -->

    <!-- 待取餐 -->
    <template v-else-if="status === 'ready'">
      <button class="btn ghost press" @click="onPickupCode">取餐码</button>
      <button class="btn primary press" @click="onConfirm">确认取餐</button>
    </template>

    <!-- 已完成 -->
    <template v-else-if="status === 'completed'">
      <button class="btn ghost press" @click="onReorder">再来一单</button>
      <button v-if="!order.review" class="btn primary press" @click="emit('review', order)">去评价</button>
    </template>

    <!-- 已取消：无操作 -->
  </div>
</template>

<style lang="scss" scoped>
.order-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: $radius-full;
  font-size: $font-sm;
  cursor: pointer;
  transition: transform 150ms ease;

  &.primary {
    background: $primary-gradient;
    border: none;
    color: #fff;
  }

  &.ghost {
    background: #fff;
    border: 1px solid #d8d8d8;
    color: $text-secondary;
  }
}
</style>

<style lang="scss">
// 取餐码弹窗大字样式（全局）
.pickup-code-dialog {
  .van-dialog__message {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 8px;
    color: #FF6B35;
    padding: 30px 24px 36px;
  }
}
</style>
