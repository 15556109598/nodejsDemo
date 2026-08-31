<script setup lang="ts">
// 我的：头像/昵称/积分 + 签到日历 + 功能列表
import { onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import SignCalendar from '@/components/mine/SignCalendar.vue'

const router = useRouter()
const userStore = useUserStore()

function refreshProfile() {
  if (userStore.token) {
    userStore.fetchMe().catch(() => undefined)
  }
}

onMounted(refreshProfile)
onActivated(refreshProfile)

// 退出登录
function onLogout() {
  showConfirmDialog({
    title: '退出登录',
    message: '确定要退出当前账号吗？',
  })
    .then(() => {
      userStore.logout()
      showToast('已退出登录')
      router.replace('/login')
    })
    .catch(() => undefined)
}
</script>

<template>
  <div class="mine-page">
    <!-- 渐变头部 -->
    <div class="hero">
      <div class="user-row">
        <div class="avatar">
          <van-image v-if="userStore.profile?.avatar_url" :src="userStore.profile.avatar_url" fit="cover" width="64" height="64" round />
          <van-icon v-else name="user-o" size="32" color="#fff" />
        </div>
        <div class="user-info">
          <div class="nickname">{{ userStore.profile?.nickname || '小厨食客' }}</div>
          <div class="email hint-text email-on-gradient">{{ userStore.profile?.email || '' }}</div>
        </div>
      </div>

      <!-- 积分入口 -->
      <div class="points-card press" @click="router.push('/points')">
        <div class="points-left">
          <span class="points-label">我的积分</span>
          <span class="points-num">{{ userStore.profile?.points ?? 0 }}</span>
        </div>
        <span class="points-more">积分明细 <van-icon name="arrow" /></span>
      </div>
    </div>

    <!-- 签到日历 -->
    <div class="section">
      <SignCalendar @signed="refreshProfile" />
    </div>

    <!-- 功能列表 -->
    <div class="section">
      <van-cell-group inset class="func-group">
        <van-cell title="我的订单" icon="orders-o" is-link @click="router.push('/order')" />
        <van-cell title="积分明细" icon="medal-o" is-link @click="router.push('/points')" />
        <van-cell title="退出登录" icon="revoke" is-link @click="onLogout" />
      </van-cell-group>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mine-page {
  min-height: 100vh;
  background: $bg-page;
  padding-bottom: calc(70px + env(safe-area-inset-bottom));
}

.hero {
  padding: calc(24px + env(safe-area-inset-top)) 16px 56px;
  background: $primary-gradient;
  border-radius: 0 0 24px 24px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 14px;

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .nickname {
    font-size: $font-lg;
    font-weight: $font-bold;
    color: #fff;
  }

  .email-on-gradient {
    color: rgba(255, 255, 255, 0.85);
    margin-top: 2px;
  }
}

.points-card {
  margin-top: 18px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: $radius-md;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(4px);

  .points-left {
    display: flex;
    flex-direction: column;

    .points-label {
      font-size: $font-sm;
      color: rgba(255, 255, 255, 0.9);
    }

    .points-num {
      font-size: $font-xxl;
      font-weight: $font-bold;
      color: #fff;
      line-height: 1.2;
    }
  }

  .points-more {
    font-size: $font-sm;
    color: #fff;
    display: flex;
    align-items: center;
  }
}

.section {
  margin-top: -32px;
  padding: 0 0 12px;

  &:first-of-type {
    margin-top: -40px;
  }
}

.func-group {
  border-radius: $radius-md;
  overflow: hidden;

  :deep(.van-cell__left-icon) {
    color: $primary;
    font-size: 18px;
    margin-right: 8px;
  }
}
</style>
