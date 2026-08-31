<script setup lang="ts">
// 结算弹层：菜品汇总 / 取餐号 / 备注 / 积分抵扣 / 提交订单
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { orderApi } from '@/api'
import type { Order } from '@/api/types'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { formatPrice } from '@/utils/format'
import { showToast } from 'vant'

const props = defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const router = useRouter()
const cart = useCartStore()
const userStore = useUserStore()

const remark = ref('')
const usePoints = ref(false)
const pointsUsed = ref(0)
const submitting = ref(false)
const pickupNo = ref('')

// 随机取餐号：2 位字母 + 2 位数字
function genPickupNo() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const l = () => letters[Math.floor(Math.random() * letters.length)]
  const d = () => String(Math.floor(Math.random() * 10))
  pickupNo.value = `${l()}${l()}${d()}${d()}`
}

// 用户积分
const userPoints = computed(() => userStore.profile?.points ?? 0)

// 最多可抵扣积分：floor(总价/2)*10（最多抵扣 50%），且不超过用户积分
const maxDeduct = computed(() => Math.max(0, Math.min(userPoints.value, Math.floor(cart.totalPrice / 2) * 10)))

// 抵扣金额（10 积分 = 1 元）
const deductAmount = computed(() => pointsUsed.value / 10)

// 应付金额
const payable = computed(() => Math.max(0, Math.round((cart.totalPrice - deductAmount.value) * 100) / 100))

// 弹窗打开时初始化
watch(
  () => props.visible,
  (v) => {
    if (v) {
      remark.value = ''
      usePoints.value = false
      pointsUsed.value = 0
      genPickupNo()
      if (!userStore.profile) {
        userStore.fetchMe().catch(() => undefined)
      }
    }
  }
)

// 上限变化时夹紧已选积分
watch(maxDeduct, (v) => {
  if (pointsUsed.value > v) pointsUsed.value = v
})

function close() {
  emit('update:visible', false)
}

async function submit() {
  if (submitting.value || !cart.items.length) return
  submitting.value = true
  try {
    const order: Order = await orderApi.create({
      items: cart.items.map((i) => ({ dishId: i.dishId, spec: i.spec, qty: i.qty })),
      remark: remark.value,
      pointsUsed: usePoints.value ? pointsUsed.value : 0,
    })
    showToast('下单成功')
    cart.clear()
    close()
    router.push(`/order/${order.id}`)
  } catch {
    // 错误已在拦截器统一 toast
  } finally {
    submitting.value = false
  }
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
    <div class="checkout-sheet">
      <div class="head">确认订单</div>

      <div class="body">
        <!-- 菜品汇总 -->
        <div class="card block">
          <div class="block-title">菜品清单</div>
          <div v-for="item in cart.items" :key="`${item.dishId}-${item.spec}`" class="sum-item">
            <van-image :src="item.image_url" fit="cover" width="44" height="44" radius="8" lazy-load />
            <div class="sum-info">
              <div class="name">{{ item.name }}</div>
              <div v-if="item.spec" class="spec hint-text">{{ item.spec }}</div>
            </div>
            <div class="sum-right">
              <div class="qty">x{{ item.qty }}</div>
              <div class="amount">¥{{ formatPrice(item.unitPrice * item.qty) }}</div>
            </div>
          </div>
        </div>

        <!-- 堂食信息 -->
        <div class="card block row-block">
          <span class="label">堂食取餐号</span>
          <span class="pickup-no">{{ pickupNo }}</span>
        </div>

        <!-- 备注 -->
        <div class="card block">
          <van-field
            v-model="remark"
            label="备注"
            type="textarea"
            rows="1"
            autosize
            maxlength="50"
            placeholder="口味偏好、忌口等（选填）"
          />
        </div>

        <!-- 积分抵扣 -->
        <div class="card block">
          <div class="points-row">
            <div class="points-info">
              <div class="label">积分抵扣</div>
              <div class="hint-text">可用 {{ userPoints }} 积分抵扣 {{ formatPrice(userPoints / 10) }} 元（最多抵扣50%）</div>
            </div>
            <van-switch v-model="usePoints" size="22" />
          </div>
          <div v-if="usePoints" class="points-stepper">
            <span class="hint-text">选择抵扣积分</span>
            <van-stepper v-model="pointsUsed" :step="10" :min="0" :max="maxDeduct" integer />
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="footer safe-bottom">
        <div class="total price-text">
          <span class="label">合计</span>¥{{ formatPrice(payable) }}
        </div>
        <button class="submit-btn press" :disabled="submitting || !cart.items.length" @click="submit">
          {{ submitting ? '提交中...' : '提交订单' }}
        </button>
      </div>
    </div>
  </van-popup>
</template>

<style lang="scss" scoped>
.checkout-sheet {
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.head {
  padding: 16px;
  font-size: 18px;
  font-weight: $font-bold;
  text-align: center;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.block {
  padding: 12px;
  margin-bottom: 10px;
}

.block-title {
  font-size: $font-md;
  font-weight: $font-medium;
  margin-bottom: 10px;
}

.sum-item {
  display: flex;
  align-items: center;
  gap: 10px;

  & + .sum-item {
    margin-top: 10px;
  }

  .sum-info {
    flex: 1;
    min-width: 0;

    .name {
      font-size: $font-sm;
      font-weight: $font-medium;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .sum-right {
    text-align: right;

    .qty {
      font-size: $font-xs;
      color: $text-hint;
    }

    .amount {
      font-size: $font-sm;
      font-weight: $font-medium;
    }
  }
}

.row-block {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .label {
    font-size: $font-md;
    font-weight: $font-medium;
  }

  .pickup-no {
    font-size: 22px;
    font-weight: $font-bold;
    color: $primary;
    letter-spacing: 2px;
  }
}

.points-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  .label {
    font-size: $font-md;
    font-weight: $font-medium;
    margin-bottom: 2px;
  }
}

.points-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed $border;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  box-shadow: $shadow-popup;

  .total {
    font-size: 22px;

    .label {
      font-size: $font-sm;
      color: $text-secondary;
      margin-right: 6px;
    }
  }

  .submit-btn {
    min-width: 150px;
    height: 42px;
    border: none;
    border-radius: $radius-full;
    background: $primary-gradient;
    color: #fff;
    font-size: $font-md;
    font-weight: $font-medium;

    &:disabled {
      opacity: 0.6;
    }
  }
}
</style>
