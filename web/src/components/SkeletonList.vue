<script setup lang="ts">
// 通用列表骨架屏（3 组）
</script>

<template>
  <div class="skeleton-list">
    <van-skeleton v-for="i in 3" :key="i" title :row="3" round class="skeleton-item" />
  </div>
</template>

<style lang="scss" scoped>
.skeleton-list {
  padding: $spacing-md;
}

.skeleton-item {
  margin-bottom: $spacing-lg;
}
</style>
