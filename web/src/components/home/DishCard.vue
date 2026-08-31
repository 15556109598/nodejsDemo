<script setup lang="ts">
// 菜品卡片：图/名称/评分/月售/辣度/价格/加购按钮
import { computed } from 'vue'
import type { Dish } from '@/api/types'
import { formatPrice, formatSales, formatSpiciness } from '@/utils/format'

const props = defineProps<{ dish: Dish; index: number }>()

const emit = defineEmits<{
  (e: 'add', payload: { x: number; y: number }): void
  (e: 'detail'): void
}>()

// 入场 stagger 延迟（上限 500ms）
const delay = computed(() => `${Math.min(props.index * 50, 500)}ms`)

// 点击加购：抛出按钮中心坐标供飞入动画使用
function onAdd(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  emit('add', { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
}
</script>

<template>
  <div
    class="dish-card card press"
    :class="{ 'is-sold-out': dish.sold_out }"
    :style="{ animationDelay: delay }"
    @click="emit('detail')"
  >
    <div class="dish-img">
      <van-image :src="dish.image_url" fit="cover" lazy-load width="100%" height="100%">
        <template v-if="dish.sold_out" #loading>
          <div class="img-loading"><van-loading size="20" /></div>
        </template>
      </van-image>
      <div v-if="dish.sold_out" class="sold-tag">售罄</div>
    </div>

    <div class="dish-info">
      <div class="dish-name">{{ dish.name }}</div>
      <div class="dish-meta">
        <span class="rating">⭐ {{ dish.rating.toFixed(1) }}</span>
        <span class="sales hint-text">{{ formatSales(dish.monthly_sales) }}</span>
      </div>
      <div v-if="dish.spiciness" class="spicy">{{ formatSpiciness(dish.spiciness) }}</div>

      <div class="dish-bottom">
        <div class="price price-text">
          <span class="symbol">¥</span>
          <span class="num">{{ formatPrice(dish.price) }}</span>
        </div>
        <button v-if="!dish.sold_out" class="add-btn press" @click.stop="onAdd">
          <van-icon name="plus" size="16" color="#fff" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dish-card {
  overflow: hidden;
  animation: fade-up 400ms ease-out both;
}

.is-sold-out {
  filter: grayscale(1);
  opacity: 0.6;
}

.dish-img {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: $radius-md $radius-md 0 0;
  overflow: hidden;
  background: #f2f3f5;

  .img-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .sold-tag {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 4px 14px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: $font-sm;
    border-radius: $radius-full;
    white-space: nowrap;
  }
}

.dish-info {
  padding: 8px 10px 10px;
}

.dish-name {
  font-size: $font-md;
  font-weight: $font-bold;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  min-height: 40px;
}

.dish-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;

  .rating {
    color: $primary;
    font-size: $font-xs;
    font-weight: $font-medium;
  }
}

.spicy {
  margin-top: 2px;
  font-size: $font-xs;
}

.dish-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 6px;

  .price {
    display: flex;
    align-items: baseline;
    line-height: 1;

    .symbol {
      font-size: $font-sm;
      margin-right: 1px;
    }

    .num {
      font-size: 22px;
    }
  }
}

.add-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: $primary-gradient;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(255, 107, 53, 0.4);
  cursor: pointer;
}
</style>
