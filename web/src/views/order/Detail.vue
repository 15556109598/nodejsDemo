<script setup lang="ts">
// 订单详情：状态区 + 步骤条 + 信息卡 + 吸底操作 + 5s 轮询
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { orderApi } from '@/api'
import type { Order, OrderStatus } from '@/api/types'
import NavBar from '@/components/NavBar.vue'
import StatusTag from '@/components/order/StatusTag.vue'
import OrderActions from '@/components/order/OrderActions.vue'
import { formatPrice, fmtDateTime } from '@/utils/format'

const route = useRoute()

const order = ref<Order | null>(null)
const loading = ref(true)
let pollTimer: number | null = null

// 状态展示映射
const STATUS_META: Record<OrderStatus, { icon: string; title: string; sub: () => string }> = {
  pending_pay: { icon: 'clock-o', title: '待支付', sub: () => '请尽快完成支付' },
  preparing: { icon: 'fire-o', title: '制作中', sub: () => '小厨正在快马加鞭' },
  ready: {
    icon: 'bell',
    title: '待取餐',
    sub: () => `已出餐，取餐号 ${order.value ? order.value.order_no.slice(-4) : ''}`,
  },
  completed: { icon: 'passed', title: '已完成', sub: () => '感谢惠顾，期待下次光临' },
  cancelled: { icon: 'close', title: '已取消', sub: () => '订单已取消' },
}

const meta = computed(() => (order.value ? STATUS_META[order.value.status] : null))

// 步骤条：提交订单→支付完成→制作中→待取餐→已完成
const STEPS = ['提交订单', '支付完成', '制作中', '待取餐', '已完成']

const activeStep = computed(() => {
  if (!order.value) return -1
  switch (order.value.status) {
    case 'pending_pay':
      return 0
    case 'preparing':
      return 2
    case 'ready':
      return 3
    case 'completed':
      return 4
    default:
      return -1 // 已取消
  }
})

// 实付 = 商品总价 - 积分抵扣（10 积分 = 1 元）
const paid = computed(() => {
  if (!order.value) return 0
  return Math.max(0, Math.round((order.value.total - order.value.points_used / 10) * 100) / 100)
})

// 总件数
const totalQty = computed(() => (order.value?.items || []).reduce((s, i) => s + i.qty, 0))

// 是否有吸底按钮
const hasActions = computed(() => {
  const s = order.value?.status
  return s === 'pending_pay' || s === 'ready' || s === 'completed'
})

// 取餐号（订单号后 4 位）
const pickupNo = computed(() => (order.value ? order.value.order_no.slice(-4) : ''))

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    order.value = await orderApi.detail(route.params.id as string)
  } catch {
    // 错误已在拦截器统一提示
  } finally {
    loading.value = false
  }
}

// 轮询：通过列表接口触发后端自动推进（制作中 20 秒后变待取餐），再同步本单状态
async function poll() {
  const s = order.value?.status
  if (s !== 'pending_pay' && s !== 'preparing') return
  try {
    const res = await orderApi.list({ status: 'all', page: 1, pageSize: 10 })
    const hit = (res.list || []).find((o) => String(o.id) === String(route.params.id))
    if (hit) order.value = hit
  } catch {
    // 静默失败
  }
}

// 复制订单号
function copyOrderNo() {
  if (!order.value) return
  const text = order.value.order_no
  const fallback = () => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      showToast('订单号已复制')
    } catch {
      showToast('复制失败，请手动复制')
    }
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('订单号已复制'))
      .catch(fallback)
  } else {
    fallback()
  }
}

// 操作后刷新
function onActionRefresh() {
  load(true)
}

onMounted(() => {
  load()
  pollTimer = window.setInterval(poll, 5000)
})

onUnmounted(() => {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="order-detail-page">
    <NavBar title="订单详情" />

    <div v-if="loading && !order" class="loading-wrap">
      <SkeletonList />
    </div>

    <template v-else-if="order">
      <!-- 渐变状态区 -->
      <div class="status-hero">
        <div class="status-icon">
          <van-icon :name="meta?.icon || 'clock-o'" size="30" color="#FF6B35" />
        </div>
        <div class="status-text">
          <div class="status-title">{{ meta?.title }}</div>
          <div class="status-sub">{{ meta?.sub() }}</div>
        </div>
        <StatusTag :status="order.status" />
      </div>

      <!-- 步骤条 -->
      <div class="card steps-card">
        <template v-for="(s, i) in STEPS" :key="s">
          <div class="step" :class="{ done: i < activeStep, current: i === activeStep }">
            <div class="dot">
              <van-icon v-if="i < activeStep" name="success" size="12" color="#fff" />
            </div>
            <div class="step-label">{{ s }}</div>
          </div>
          <div v-if="i < STEPS.length - 1" class="line" :class="{ active: i < activeStep }"></div>
        </template>
      </div>

      <!-- 堂食信息 -->
      <div class="card info-card">
        <div class="card-title">堂食信息</div>
        <div class="info-row">
          <span class="label">门店</span><span>小厨·现炒（堂食）</span>
        </div>
        <div class="info-row">
          <span class="label">就餐方式</span><span>堂食</span>
        </div>
        <div class="info-row">
          <span class="label">取餐号</span><span class="pickup">{{ pickupNo }}</span>
        </div>
      </div>

      <!-- 商品清单 -->
      <div class="card info-card">
        <div class="card-title">商品清单 <span class="hint-text">共 {{ totalQty }} 件</span></div>
        <div v-for="it in order.items || []" :key="it.id" class="goods-row">
          <van-image :src="it.image_url" fit="cover" width="52" height="52" radius="8" lazy-load />
          <div class="goods-info">
            <div class="goods-name">{{ it.dish_name }}</div>
            <div v-if="it.spec" class="hint-text">{{ it.spec }}</div>
            <div class="goods-price">¥{{ formatPrice(it.unit_price) }} <span class="hint-text">x{{ it.qty }}</span></div>
          </div>
          <div class="goods-subtotal price-text">¥{{ formatPrice(Math.round(it.unit_price * it.qty * 100) / 100) }}</div>
        </div>
      </div>

      <!-- 价格明细 -->
      <div class="card info-card">
        <div class="card-title">价格明细</div>
        <div class="info-row">
          <span class="label">商品总价</span><span>¥{{ formatPrice(order.total) }}</span>
        </div>
        <div v-if="order.points_used > 0" class="info-row">
          <span class="label">积分抵扣</span><span class="deduct">-{{ formatPrice(order.points_used / 10) }}</span>
        </div>
        <div class="info-row paid-row">
          <span class="label">实付</span>
          <span class="paid price-text"><span class="symbol">¥</span>{{ formatPrice(paid) }}</span>
        </div>
        <div v-if="order.points_earned > 0 && order.status !== 'cancelled'" class="earn-tip hint-text">
          本单可得 {{ order.points_earned }} 积分
        </div>
      </div>

      <!-- 订单信息 -->
      <div class="card info-card">
        <div class="card-title">订单信息</div>
        <div class="info-row" @click="copyOrderNo">
          <span class="label">订单号</span>
          <span class="order-no">{{ order.order_no }} <van-icon name="records-o" size="13" color="#c8c9cc" /></span>
        </div>
        <div class="info-row">
          <span class="label">下单时间</span><span>{{ fmtDateTime(order.created_at) }}</span>
        </div>
        <div v-if="order.paid_at" class="info-row">
          <span class="label">支付时间</span><span>{{ fmtDateTime(order.paid_at) }}</span>
        </div>
      </div>

      <!-- 吸底操作 -->
      <div v-if="hasActions" class="action-bar safe-bottom">
        <OrderActions :order="order" @refresh="onActionRefresh" @review="onActionRefresh" />
      </div>
      <div v-else class="bottom-placeholder safe-bottom"></div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.order-detail-page {
  min-height: 100vh;
  background: $bg-page;
  padding-top: calc(46px + env(safe-area-inset-top));
  padding-bottom: 20px;
}

.loading-wrap {
  padding-top: 12px;
}

// 状态区
.status-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 16px 26px;
  background: $primary-gradient;

  .status-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .status-text {
    flex: 1;
    min-width: 0;

    .status-title {
      font-size: 20px;
      font-weight: $font-bold;
      color: #fff;
    }

    .status-sub {
      margin-top: 4px;
      font-size: $font-sm;
      color: rgba(255, 255, 255, 0.9);
    }
  }
}

// 步骤条
.steps-card {
  display: flex;
  align-items: flex-start;
  margin: -16px 12px 0;
  padding: 16px 14px 12px;
  position: relative;
  z-index: 1;

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 56px;
    flex-shrink: 0;

    .dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid $border;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .step-label {
      margin-top: 6px;
      font-size: 11px;
      color: $text-hint;
      white-space: nowrap;
    }

    &.done .dot,
    &.current .dot {
      border-color: $primary;
      background: $primary-gradient;
    }

    &.current .dot {
      box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.15);
    }

    &.current .step-label {
      color: $primary;
      font-weight: $font-medium;
    }
  }

  .line {
    flex: 1;
    height: 2px;
    background: $border;
    margin-top: 9px;
    min-width: 8px;

    &.active {
      background: $primary;
    }
  }
}

// 信息卡
.info-card {
  margin: 12px;
  padding: 14px;

  .card-title {
    font-size: $font-md;
    font-weight: $font-bold;
    margin-bottom: 12px;

    .hint-text {
      font-weight: $font-regular;
      margin-left: 6px;
    }
  }
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: $font-sm;

  .label {
    color: $text-hint;
  }

  .pickup {
    font-size: 18px;
    font-weight: $font-bold;
    color: $primary;
    letter-spacing: 3px;
  }

  .deduct {
    color: $primary;
  }

  .order-no {
    cursor: pointer;
  }
}

.paid-row {
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px dashed $border;

  .paid {
    font-size: 22px;

    .symbol {
      font-size: $font-sm;
    }
  }
}

.earn-tip {
  margin-top: 6px;
}

// 商品行
.goods-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  & + .goods-row {
    margin-top: 12px;
  }

  .goods-info {
    flex: 1;
    min-width: 0;

    .goods-name {
      font-size: $font-sm;
      font-weight: $font-medium;
    }

    .goods-price {
      margin-top: 4px;
      font-size: $font-sm;
      color: $text-secondary;
    }
  }

  .goods-subtotal {
    font-size: $font-sm;
  }
}

// 吸底操作
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 10px 16px;
  box-shadow: $shadow-popup;
  z-index: 50;
}

.bottom-placeholder {
  height: 20px;
}
</style>
