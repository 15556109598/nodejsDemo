<script setup lang="ts">
// 首页：点餐主界面（渐变头部 + 搜索 + 分类两栏 + 购物车）
import { ref, onMounted, onActivated, onDeactivated } from 'vue'
import { menuApi } from '@/api'
import type { Category, Dish } from '@/api/types'
import { useCartStore } from '@/stores/cart'
import { flyToCart } from '@/utils/fly'
import DishCard from '@/components/home/DishCard.vue'
import DishDetailSheet from '@/components/home/DishDetailSheet.vue'
import CartBar from '@/components/home/CartBar.vue'
import CartPanel from '@/components/home/CartPanel.vue'
import CheckoutSheet from '@/components/home/CheckoutSheet.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import { showToast } from 'vant'

defineOptions({ name: 'Home' })

const cart = useCartStore()

const categories = ref<Category[]>([])
const activeCategory = ref(0)
const keyword = ref('')
const dishes = ref<Dish[]>([])
const loading = ref(true)

// 弹层状态
const detailVisible = ref(false)
const detailDish = ref<Dish | null>(null)
const panelVisible = ref(false)
const checkoutVisible = ref(false)

const cartBarRef = ref<InstanceType<typeof CartBar> | null>(null)

let searchTimer: number | null = null
let dirty = false // 离开页面期间购物车/菜单是否需要刷新

// 当前查询参数（关键词优先）
function currentParams() {
  const kw = keyword.value.trim()
  if (kw) return { keyword: kw }
  if (activeCategory.value) return { categoryId: activeCategory.value }
  return undefined
}

async function loadCategories() {
  try {
    const list = await menuApi.categories()
    // 顶部插入"全部"伪分类
    categories.value = [{ id: 0, name: '全部', sort: 0 }, ...list]
  } catch {
    // 错误已在拦截器统一提示
  }
}

async function loadDishes(params?: { categoryId?: number; keyword?: string }) {
  try {
    dishes.value = await menuApi.dishes(params)
  } catch {
    // 错误已在拦截器统一提示
  }
}

async function initLoad() {
  loading.value = true
  await Promise.all([loadCategories(), loadDishes()])
  loading.value = false
}

onMounted(initLoad)

// keep-alive 回来时静默刷新当前列表
onActivated(() => {
  if (dirty) {
    dirty = false
    loadDishes(currentParams())
  }
})
onDeactivated(() => {
  dirty = true
})

// 搜索防抖 300ms
function onSearch() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    searchTimer = null
    loadDishes(currentParams())
  }, 300)
}

// 切换分类
function selectCategory(id: number) {
  activeCategory.value = id
  keyword.value = ''
  loadDishes(id ? { categoryId: id } : undefined)
}

// 点击卡片 → 详情弹层
function openDetail(dish: Dish) {
  detailDish.value = dish
  detailVisible.value = true
}

// 加购按钮：有规格走详情选择，无规格直接飞入购物车
function onCardAdd(dish: Dish, pos: { x: number; y: number }) {
  if (dish.specs && dish.specs.length > 0) {
    openDetail(dish)
    return
  }
  flyToCart(pos.x, pos.y, cartBarRef.value?.iconEl ?? document.body)
    .then(() => {
      cart.add(dish, '', dish.price, 1)
    })
    .catch(() => {
      showToast('加入购物车失败')
    })
}
</script>

<template>
  <div class="home-page">
    <!-- 顶部渐变头部 -->
    <div class="home-header">
      <div class="brand-row">
        <div class="logo">
          <van-icon name="shop-o" size="26" color="#fff" />
        </div>
        <div class="brand-text">
          <div class="title">jump jump</div>
          <div class="slogan">新鲜现炒 · 堂食更香</div>
        </div>
      </div>
      <van-search
        v-model="keyword"
        placeholder="搜索菜品"
        shape="round"
        background="transparent"
        @update:model-value="onSearch"
      />
    </div>

    <!-- 主体两栏 -->
    <div class="home-body">
      <!-- 左：分类栏 -->
      <aside class="cat-aside">
        <div
          v-for="c in categories"
          :key="c.id"
          class="cat-item"
          :class="{ active: activeCategory === c.id && !keyword.trim() }"
          @click="selectCategory(c.id)"
        >
          {{ c.name }}
        </div>
      </aside>

      <!-- 右：菜品两列网格 -->
      <section class="dish-area">
        <SkeletonList v-if="loading" />
        <template v-else>
          <div v-if="dishes.length" class="dish-grid">
            <DishCard
              v-for="(d, i) in dishes"
              :key="d.id"
              :dish="d"
              :index="i"
              @add="(p) => onCardAdd(d, p)"
              @detail="openDetail(d)"
            />
          </div>
          <EmptyState v-else description="没有找到相关菜品，换个关键词试试吧" />
        </template>
      </section>
    </div>

    <!-- 悬浮购物车栏 -->
    <CartBar ref="cartBarRef" @open-panel="panelVisible = true" @checkout="checkoutVisible = true" />

    <!-- 购物车面板 -->
    <CartPanel v-model:visible="panelVisible" @checkout="checkoutVisible = true" />

    <!-- 菜品详情 -->
    <DishDetailSheet v-model:visible="detailVisible" :dish="detailDish" />

    <!-- 结算 -->
    <CheckoutSheet v-model:visible="checkoutVisible" />
  </div>
</template>

<style lang="scss" scoped>
.home-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $bg-page;
}

// 顶部渐变头部（状态栏沉浸）
.home-header {
  flex-shrink: 0;
  padding-top: env(safe-area-inset-top);
  background: $primary-gradient;

  .brand-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px 4px;

    .logo {
      width: 44px;
      height: 44px;
      border-radius: $radius-md;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .title {
      font-size: $font-lg;
      font-weight: $font-bold;
      color: #fff;
    }

    .slogan {
      font-size: $font-xs;
      color: rgba(255, 255, 255, 0.85);
    }
  }
}

.home-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

// 左分类栏
.cat-aside {
  width: 88px;
  flex-shrink: 0;
  background: #fff;
  overflow-y: auto;
  // 给悬浮购物车 + tabbar 留出空间
  padding-bottom: calc(130px + env(safe-area-inset-bottom));
}

.cat-item {
  position: relative;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: $text-secondary;
  cursor: pointer;
  transition: all 150ms ease;

  &.active {
    color: $primary;
    font-weight: $font-bold;
    background: $bg-page;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 28px;
      background: $primary;
      border-radius: 0 4px 4px 0;
    }
  }
}

// 右菜品区
.dish-area {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-bottom: calc(130px + env(safe-area-inset-bottom));
}

.dish-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px;
}
</style>
