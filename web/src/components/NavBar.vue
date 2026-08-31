<script setup lang="ts">
// 通用导航栏：渐变背景 + 白字 + 返回
import { useRouter } from 'vue-router'

defineProps<{ title: string }>()

const router = useRouter()

function onBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace('/')
  }
}
</script>

<template>
  <div class="nav-bar-wrap">
    <van-nav-bar :title="title" left-arrow @click-left="onBack" />
  </div>
</template>

<style lang="scss" scoped>
.nav-bar-wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding-top: env(safe-area-inset-top);
  background: $primary-gradient;

  :deep(.van-nav-bar) {
    background: transparent;
  }

  :deep(.van-nav-bar__title) {
    font-weight: $font-medium;
  }
}
</style>
