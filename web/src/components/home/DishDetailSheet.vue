<script setup lang="ts">
// 菜品详情弹层：大图 / 规格 chips 单选 / 数量 / 加入购物车
import { ref, computed, watch } from 'vue'
import type { Dish } from '@/api/types'
import { useCartStore } from '@/stores/cart'
import { formatPrice, formatSales, formatSpiciness } from '@/utils/format'
import { showToast } from 'vant'

const props = defineProps<{ visible: boolean; dish: Dish | null }>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const cart = useCartStore()

// 每组规格选中的 option 下标
const selected = ref<number[]>([])
const qty = ref(1)

// 弹窗打开 / 菜品切换时重置选择（默认每组第一个）
watch(
  () => [props.visible, props.dish?.id],
  ([val]) => {
    if (val && props.dish) {
      selected.value = (props.dish.specs || []).map(() => 0)
      qty.value = 1
    }
  },
  { immediate: true }
)

// 规格文本（与后端约定 '/' 分隔）
const specText = computed(() => {
  if (!props.dish) return ''
  return (props.dish.specs || [])
    .map((g, i) => g.options[selected.value[i]]?.label || '')
    .filter(Boolean)
    .join('/')
})

// 单价 = 基础价 + 选中 delta
const unitPrice = computed(() => {
  if (!props.dish) return 0
  let price = props.dish.price
  ;(props.dish.specs || []).forEach((g, i) => {
    const opt = g.options[selected.value[i]]
    if (opt) price += opt.delta
  })
  return price
})

// 合计
const total = computed(() => Math.round(unitPrice.value * qty.value * 100) / 100)

function close() {
  emit('update:visible', false)
}

function confirmAdd() {
  if (!props.dish) return
  cart.add(props.dish, specText.value, unitPrice.value, qty.value)
  showToast('已加入购物车')
  close()
}
</script>

<template>
  <van-popup
    :show="visible"
    position="bottom"
    closeable
    round
    :style="{ borderRadius: '20px 20px 0 0' }"
    @update:show="(v: boolean) => emit('update:visible', v)"
  >
    <div v-if="dish" class="detail-sheet">
      <!-- 顶部拖动条 -->
      <div class="grabber"></div>

      <!-- 大图 -->
      <div class="hero">
        <van-image :src="dish.image_url" fit="cover" width="100%" height="100%">
          <template #loading>
            <div class="img-loading"><van-loading size="24" /></div>
          </template>
        </van-image>
      </div>

      <div class="body">
        <div class="title-row">
          <div class="name">{{ dish.name }}</div>
          <div class="price price-text"><span class="symbol">¥</span><span class="num">{{ formatPrice(unitPrice) }}</span></div>
        </div>

        <div class="meta">
          <span class="rating">⭐ {{ dish.rating.toFixed(1) }}</span>
          <span class="hint-text">{{ formatSales(dish.monthly_sales) }}</span>
          <span v-if="dish.spiciness" class="spicy">{{ formatSpiciness(dish.spiciness) }}</span>
        </div>

        <div v-if="dish.description" class="desc">{{ dish.description }}</div>

        <!-- 规格组 -->
        <div v-for="(group, gi) in dish.specs || []" :key="group.name" class="spec-group">
          <div class="spec-name">{{ group.name }}</div>
          <div class="chips">
            <div
              v-for="(opt, oi) in group.options"
              :key="opt.label"
              class="chip"
              :class="{ active: selected[gi] === oi }"
              @click="selected[gi] = oi"
            >
              {{ opt.label }}<span v-if="opt.delta">+{{ opt.delta }}</span>
            </div>
          </div>
        </div>

        <!-- 数量 -->
        <div class="qty-row">
          <span class="qty-label">数量</span>
          <van-stepper v-model="qty" :min="1" :max="99" integer />
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="footer safe-bottom">
        <div class="total price-text">
          <span class="label">合计</span>
          <span class="symbol">¥</span>
          <span class="num">{{ formatPrice(total) }}</span>
        </div>
        <button class="confirm-btn press" @click="confirmAdd">加入购物车</button>
      </div>
    </div>
  </van-popup>
</template>

<style lang="scss" scoped>
.detail-sheet {
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.grabber {
  width: 36px;
  height: 4px;
  border-radius: $radius-full;
  background: #ddd;
  margin: 10px auto 0;
}

.hero {
  height: 220px;
  margin: 12px 16px 0;
  border-radius: $radius-md;
  overflow: hidden;

  .img-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;

  .name {
    font-size: 18px;
    font-weight: $font-bold;
  }

  .price .num {
    font-size: 22px;
  }

  .price .symbol {
    font-size: $font-sm;
  }
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;

  .rating {
    color: $primary;
    font-size: $font-sm;
    font-weight: $font-medium;
  }

  .spicy {
    font-size: $font-xs;
  }
}

.desc {
  margin-top: 10px;
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.spec-group {
  margin-top: 14px;

  .spec-name {
    font-size: $font-md;
    font-weight: $font-medium;
    margin-bottom: 8px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    padding: 6px 14px;
    border-radius: $radius-full;
    background: #f5f6fa;
    color: $text-secondary;
    font-size: $font-sm;
    border: 1px solid transparent;
    transition: all 150ms ease;

    &.active {
      background: $primary;
      color: #fff;
      border-color: $primary;
    }

    span {
      font-size: $font-xs;
      margin-left: 2px;
    }
  }
}

.qty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;

  .qty-label {
    font-size: $font-md;
    font-weight: $font-medium;
  }
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  box-shadow: $shadow-popup;

  .total {
    display: flex;
    align-items: baseline;

    .label {
      font-size: $font-sm;
      color: $text-secondary;
      margin-right: 6px;
    }

    .num {
      font-size: 22px;
    }
  }

  .confirm-btn {
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
