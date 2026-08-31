<script setup lang="ts">
// 订单列表：6 状态 Tab + 下拉刷新 + 上拉分页
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { orderApi } from '@/api'
import type { Order, OrderStatus } from '@/api/types'
import OrderCard from '@/components/order/OrderCard.vue'
import ReviewSheet from '@/components/order/ReviewSheet.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonList from '@/components/SkeletonList.vue'

const route = useRoute()

const TABS: { label: string; value: 'all' | OrderStatus }[] = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending_pay' },
  { label: '制作中', value: 'preparing' },
  { label: '待取餐', value: 'ready' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

const PAGE_SIZE = 10

const active = ref(0)
const firstLoading = ref(true)

const orders = ref<Order[]>([])
const page = ref(1)
const total = ref(0)
const loadingList = ref(false)
const finished = ref(false)
const refreshing = ref(false)

// 评价弹层
const reviewVisible = ref(false)
const reviewOrderId = ref<number | null>(null)

function resetList() {
  page.value = 1
  total.value = 0
  finished.value = false
  loadingList.value = true
}

async function loadPage() {
  try {
    const res = await orderApi.list({
      status: TABS[active.value].value,
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    const list = res.list || []
    orders.value = page.value === 1 ? list : [...orders.value, ...list]
    total.value = res.total || 0
    page.value += 1
    if (orders.value.length >= total.value || list.length < PAGE_SIZE) {
      finished.value = true
    }
  } catch {
    // 错误已在拦截器统一提示，保持可重试
  } finally {
    loadingList.value = false
    refreshing.value = false
  }
}

// 上拉加载（van-list 触底）
function onLoad() {
  loadPage()
}

// 下拉刷新 / 操作后刷新
function reload() {
  resetList()
  loadPage()
}

function onRefresh() {
  reload()
}

// 切换 Tab
function onTabChange() {
  orders.value = []
  reload()
}

// 打开评价
function openReview(order: Order) {
  reviewOrderId.value = order.id
  reviewVisible.value = true
}

onMounted(() => {
  // 支持 route.query.tab 传初始 tab 下标
  const t = Number(route.query.tab)
  if (Number.isInteger(t) && t >= 0 && t < TABS.length) {
    active.value = t
  }
  resetList()
  loadPage().finally(() => (firstLoading.value = false))
})
</script>

<template>
  <div class="order-list-page">
    <van-tabs v-model:active="active" sticky swipeable @change="onTabChange">
      <van-tab v-for="(t, i) in TABS" :key="t.value" :title="t.label">
        <div v-if="firstLoading" class="tab-body"><SkeletonList /></div>
        <div v-else class="tab-body">
          <van-pull-refresh
            v-model="refreshing"
            loading-text="小厨正在加载..."
            success-text="刷新成功"
            @refresh="onRefresh"
          >
            <!-- :key 重建列表确保各 tab 分页状态独立 -->
            <van-list
              :key="i === active ? active : -1"
              v-model:loading="loadingList"
              :finished="finished"
              loading-text="小厨正在加载..."
              finished-text="没有更多了"
              :immediate-check="false"
              @load="onLoad"
            >
              <div class="card-list">
                <OrderCard
                  v-for="o in orders"
                  :key="o.id"
                  :order="o"
                  @refresh="reload"
                  @review="openReview"
                />
              </div>
              <EmptyState v-if="!orders.length && !loadingList" description="这里还没有订单，去点一单吧~" />
            </van-list>
          </van-pull-refresh>
        </div>
      </van-tab>
    </van-tabs>

    <!-- 评价弹层 -->
    <ReviewSheet v-model:visible="reviewVisible" :order-id="reviewOrderId" @success="reload" />
  </div>
</template>

<style lang="scss" scoped>
.order-list-page {
  min-height: 100vh;
  background: $bg-page;
  // 底部给 tabbar 留空间
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
}

.tab-body {
  min-height: 50vh;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
</style>
