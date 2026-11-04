<script setup lang="ts">
// 入口页：模块导航/选择页（模块数据来自 @/modules 的集中配置）
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { APP_MODULES, type AppModule } from '@/modules'

const router = useRouter()

function openModule(mod: AppModule) {
  if (mod.status !== 'available') {
    showToast('该模块正在开发中')
    return
  }
  if (mod.external) {
    window.open(mod.path, '_blank', 'noopener')
    return
  }
  router.push(mod.path)
}
</script>

<template>
  <div class="portal">
    <header class="portal-header">
      <div class="brand">
        <span class="brand-icon">🍳</span>
        <div>
          <h1>小厨应用中心</h1>
          <p>选择一个模块开始使用</p>
        </div>
      </div>
      <div class="header-deco deco-1" />
      <div class="header-deco deco-2" />
    </header>

    <main class="portal-body">
      <div class="section-title">
        <span>功能模块</span>
        <em>{{ APP_MODULES.length }} 个</em>
      </div>

      <div class="module-list">
        <div
          v-for="mod in APP_MODULES"
          :key="mod.id"
          class="module-card press"
          :class="{ disabled: mod.status !== 'available' }"
          @click="openModule(mod)"
        >
          <div class="module-icon" :style="{ background: mod.accent || '#FF6B35' }">
            <span v-if="mod.iconType === 'vant'" :class="['van-icon', `van-icon-${mod.icon}`]" />
            <span v-else>{{ mod.icon }}</span>
          </div>

          <div class="module-info">
            <div class="module-name">
              {{ mod.name }}
              <span v-if="mod.badge" class="module-badge">{{ mod.badge }}</span>
            </div>
            <div class="module-desc">{{ mod.description }}</div>
            <div v-if="mod.status === 'coming'" class="module-hint">开发中，敬请期待</div>
          </div>

          <van-icon name="arrow" class="module-arrow" />
        </div>
      </div>

      <p class="portal-footer">更多模块陆续接入中</p>
    </main>
  </div>
</template>

<style scoped lang="scss">
.portal {
  min-height: 100vh;
  background: $bg-page;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.portal-header,
.portal-body {
  width: 100%;
  max-width: 480px;
}

.portal-header {
  position: relative;
  overflow: hidden;
  padding: 32px 20px 44px;
  border-radius: 0 0 24px 24px;
  background: linear-gradient(135deg, #ff6b35 0%, #ff9f43 100%);
  color: #fff;
}

.brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;

  h1 {
    font-size: $font-xl;
    font-weight: $font-bold;
    letter-spacing: 0.5px;
  }

  p {
    margin-top: 6px;
    font-size: $font-sm;
    opacity: 0.85;
  }
}

.brand-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(4px);
}

.header-deco {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
}

.deco-1 {
  width: 140px;
  height: 140px;
  right: -50px;
  top: -60px;
}

.deco-2 {
  width: 90px;
  height: 90px;
  right: 70px;
  bottom: -50px;
}

.portal-body {
  flex: 1;
  padding: 20px 16px 32px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;

  span {
    font-size: $font-md;
    font-weight: $font-bold;
    color: $text-primary;
  }

  em {
    font-style: normal;
    font-size: $font-xs;
    color: $text-hint;
  }
}

.module-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: $bg-card;
  border-radius: $radius-md;
  box-shadow: $shadow-card;

  &.disabled {
    opacity: 0.55;
  }
}

.module-icon {
  flex: none;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  font-size: 24px;
  box-shadow: 0 4px 10px rgba(255, 107, 53, 0.25);

  .van-icon {
    font-size: 24px;
  }
}

.module-info {
  flex: 1;
  min-width: 0;
}

.module-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-md;
  font-weight: $font-medium;
  color: $text-primary;
}

.module-badge {
  padding: 1px 5px;
  font-size: 10px;
  font-weight: $font-regular;
  line-height: 14px;
  color: $primary;
  background: rgba(255, 107, 53, 0.1);
  border-radius: 4px;
}

.module-desc {
  margin-top: 5px;
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.4;
}

.module-hint {
  margin-top: 4px;
  font-size: $font-xs;
  color: $text-hint;
}

.module-arrow {
  flex: none;
  color: #c8c9cc;
  font-size: 16px;
}

.portal-footer {
  padding-top: 24px;
  text-align: center;
  font-size: $font-xs;
  color: $text-hint;
}
</style>
