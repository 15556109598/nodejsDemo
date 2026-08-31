<script setup lang="ts">
// 积分明细：余额头部 + 分页流水列表
import { ref, onMounted } from 'vue'
import { pointsApi } from '@/api'
import type { PointsLog } from '@/api/types'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import { fmtDateTime } from '@/utils/format'

const userStore = useUserStore()

const PAGE_SIZE = 20

const list = ref<PointsLog[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const firstLoading = ref(true)

async function loadPage() {
  try {
    const res = await pointsApi.logs({ page: page.value, pageSize: PAGE_SIZE })
    const rows = res.list || []
    list.value = page.value === 1 ? rows : [...list.value, ...rows]
    total.value = res.total || 0
    page.value += 1
    if (list.value.length >= total.value || rows.length < PAGE_SIZE) {
      finished.value = true
    }
  } catch {
    // 错误已在拦截器统一提示
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onLoad() {
  loadPage()
}

function onRefresh() {
  page.value = 1
  finished.value = false
  loading.value = true
  loadPage()
}

onMounted(() => {
  userStore.fetchMe().catch(() => undefined)
  loadPage().finally(() => (firstLoading.value = false))
})
</script>

<template>
  <div class="points-page">
    <NavBar title="积分明细" />

    <!-- 渐变余额头部 -->
    <div class="balance-hero">
      <div class="balance-label">当前积分余额</div>
      <div class="balance-num">{{ userStore.profile?.points ?? 0 }}</div>
      <div class="balance-tip">下单可抵扣，10 积分 = 1 元</div>
    </div>

    <div class="list-wrap">
      <SkeletonList v-if="firstLoading" />
      <template v-else>
        <van-pull-refresh
          v-model="refreshing"
          loading-text="小厨正在加载..."
          success-text="刷新成功"
          @refresh="onRefresh"
        >
          <van-list
            v-model:loading="loading"
            :finished="finished"
            loading-text="小厨正在加载..."
            finished-text="没有更多了"
            :immediate-check="false"
            @load="onLoad"
          >
            <div class="log-list">
              <div v-for="log in list" :key="log.id" class="log-row card">
                <div class="icon-circle" :class="log.change > 0 ? 'up' : 'down'">
                  <van-icon :name="log.change > 0 ? 'arrow-up' : 'arrow-down'" size="18" />
                </div>
                <div class="log-info">
                  <div class="reason">{{ log.reason }}</div>
                  <div class="time hint-text">{{ fmtDateTime(log.created_at) }}</div>
                </div>
                <div class="change" :class="log.change > 0 ? 'green' : 'orange'">
                  {{ log.change > 0 ? `+${log.change}` : log.change }}
                </div>
              </div>
            </div>
            <EmptyState v-if="!list.length && !loading" description="还没有积分记录，去下一单攒积分吧~" />
          </van-list>
        </van-pull-refresh>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.points-page {
  min-height: 100vh;
  background: $bg-page;
  padding-top: calc(46px + env(safe-area-inset-top));
  padding-bottom: 20px;
}

.balance-hero {
  padding: 22px 16px 30px;
  background: $primary-gradient;
  border-radius: 0 0 24px 24px;
  text-align: center;

  .balance-label {
    font-size: $font-sm;
    color: rgba(255, 255, 255, 0.9);
  }

  .balance-num {
    margin-top: 4px;
    font-size: 44px;
    font-weight: $font-bold;
    color: #fff;
    line-height: 1.15;
  }

  .balance-tip {
    margin-top: 4px;
    font-size: $font-xs;
    color: rgba(255, 255, 255, 0.8);
  }
}

.list-wrap {
  // 与渐变头部形成叠压
  padding: 12px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;

  .icon-circle {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.up {
      background: rgba(7, 193, 96, 0.12);
      color: $success;
    }

    &.down {
      background: rgba(255, 107, 53, 0.12);
      color: $primary;
    }
  }

  .log-info {
    flex: 1;
    min-width: 0;

    .reason {
      font-size: $font-md;
      font-weight: $font-medium;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time {
      margin-top: 2px;
    }
  }

  .change {
    font-size: $font-lg;
    font-weight: $font-bold;

    &.green {
      color: $success;
    }

    &.orange {
      color: $primary;
    }
  }
}
</style>
