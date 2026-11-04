<script setup lang="ts">
// 入口页：模块导航/选择页（模块数据来自 @/modules 的集中配置）
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { APP_MODULES, type AppModule } from '@/modules'
// 入口页顶部主图：噜噜和噜妹（原图 1316×784，已压缩为 1100×655 JPEG）
import heroPhoto from '@/assets/portal/lulu-lumei.jpg'

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

// 键盘操作：Enter / Space 等价于点击（模块卡是 role=button 的自定义控件）
function onModuleKeydown(e: KeyboardEvent, mod: AppModule) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openModule(mod)
  }
}
</script>

<template>
  <div class="portal">
    <header class="portal-header">
      <div class="brand">
        <span class="brand-eyebrow">小厨 · 生活工具</span>
        <h1>小厨应用中心</h1>
        <p>选择一个模块开始使用</p>
      </div>

      <div class="hero">
        <img class="hero-img" :src="heroPhoto" alt="噜噜和噜妹" />
      </div>
    </header>

    <main class="portal-body">
      <div class="section-head">
        <h2>功能模块</h2>
        <span class="section-count">{{ APP_MODULES.length }} 个</span>
      </div>

      <div class="module-list">
        <div
          v-for="mod in APP_MODULES"
          :key="mod.id"
          class="module-card press"
          :class="{ disabled: mod.status !== 'available' }"
          role="button"
          tabindex="0"
          :aria-disabled="mod.status !== 'available'"
          :aria-label="`${mod.name}：${mod.description}`"
          @click="openModule(mod)"
          @keydown="onModuleKeydown($event, mod)"
        >
          <div class="module-icon" :style="{ background: mod.accent || '#FBE3D6' }" aria-hidden="true">
            <span v-if="mod.iconType === 'vant'" :class="['van-icon', `van-icon-${mod.icon}`]" />
            <span v-else class="module-emoji">{{ mod.icon }}</span>
          </div>

          <div class="module-info">
            <div class="module-name-row">
              <span class="module-name">{{ mod.name }}</span>
              <span v-if="mod.badge" class="module-badge">{{ mod.badge }}</span>
            </div>
            <p class="module-desc">{{ mod.description }}</p>
            <p v-if="mod.status === 'coming'" class="module-hint">开发中，敬请期待</p>
          </div>

          <van-icon name="arrow" class="module-arrow" aria-hidden="true" />
        </div>
      </div>

      <p class="portal-footer">更多模块陆续接入中</p>
    </main>
  </div>
</template>

<style scoped lang="scss">
// 说明：本页（以及零食页）统一使用大写 PX 作为长度单位。
// 项目既有的 px→vw（375 设计稿）只转换小写 px，大写 PX 保持真实像素，
// 因此桌面 1440 下不会再被等比放大，移动端与 375 设计稿 1:1 一致。
.portal {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: $bg-warm;
  color: $ink;
}

.portal-header,
.portal-body {
  width: 100%;
  max-width: 480PX;
}

.portal-header {
  position: relative;
  // 顶部留出状态栏/刘海安全区
  padding: calc(20PX + env(safe-area-inset-top)) 16PX 20PX;
  background: $bg-warm;
  border-bottom: 1PX solid $line;
}

.brand {
  .brand-eyebrow {
    display: inline-block;
    margin-bottom: 10PX;
    padding: 3PX 8PX;
    font-size: 12PX;
    line-height: 18PX;
    color: $brand-action;
    background: $brand-tint;
    border-radius: 8PX;
    letter-spacing: 0.4PX;
  }

  h1 {
    font-size: 22PX;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 0.2PX;
    color: $ink;
  }

  p {
    margin-top: 6PX;
    font-size: 13PX;
    line-height: 1.5;
    color: $ink-secondary;
  }
}

// 顶部主图：噜噜和噜妹，16:9（桌面 21:9），细描边 + 极浅阴影
.hero {
  position: relative;
  margin-top: 16PX;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 12PX;
  border: 1PX solid $line;
  box-shadow: 0 1PX 2PX rgba(36, 31, 27, 0.04), 0 8PX 24PX rgba(36, 31, 27, 0.06);
  background: $line-soft;
}

.hero-img {
  display: block;
  width: 100%;
  height: 100%;
  // 主体（两只玩偶的脸与身体）位于画面中部偏上，裁切时优先保留
  object-fit: cover;
  object-position: 50% 42%;
}

.portal-body {
  flex: 1;
  padding: 20PX 16PX 32PX;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12PX;

  h2 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }
}

.section-count {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.module-list {
  display: flex;
  flex-direction: column;
  gap: 12PX;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 14PX;
  padding: 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  box-shadow: 0 1PX 2PX rgba(36, 31, 27, 0.04);
  transition: border-color $motion-fast $ease-standard, box-shadow $motion-fast $ease-standard;

  @media (hover: hover) {
    &:hover {
      border-color: #d8cfc4;
      box-shadow: 0 1PX 2PX rgba(36, 31, 27, 0.04), 0 8PX 24PX rgba(36, 31, 27, 0.06);
    }
  }

  &.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.module-icon {
  flex: none;
  width: 44PX;
  height: 44PX;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8PX;
  border: 1PX solid $line;
  font-size: 22PX;

  .van-icon {
    font-size: 22PX;
    color: $ink-secondary;
  }
}

.module-info {
  flex: 1;
  min-width: 0;
}

.module-name-row {
  display: flex;
  align-items: center;
  gap: 6PX;
}

.module-name {
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.25;
  color: $ink;
}

.module-badge {
  flex: none;
  padding: 1PX 6PX;
  font-size: 12PX;
  font-weight: 400;
  line-height: 18PX;
  color: $brand-action;
  background: $brand-tint;
  border-radius: 8PX;
}

.module-desc {
  margin-top: 4PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.module-hint {
  margin-top: 2PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.module-arrow {
  flex: none;
  color: $ink-muted;
  font-size: 16PX;
}

.portal-footer {
  padding-top: 24PX;
  text-align: center;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

// 桌面：内容列 480→760PX 居中，主图切 21:9
@media (min-width: 768px) {
  .portal {
    padding: 24PX 0 40PX;
  }

  .portal-header,
  .portal-body {
    max-width: $content-max;
  }

  .portal-header {
    padding-left: 24PX;
    padding-right: 24PX;
    border: 1PX solid $line;
    border-radius: 20PX;
    margin-bottom: 20PX;
  }

  .portal-body {
    padding: 0 24PX;
  }

  .hero {
    aspect-ratio: 21 / 9;
  }
}
</style>
