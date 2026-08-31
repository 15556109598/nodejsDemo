<script setup lang="ts">
// 通用空状态
withDefaults(defineProps<{ description?: string }>(), {
  description: '暂无数据',
})
</script>

<template>
  <div class="empty-state">
    <van-empty :description="description" />
  </div>
</template>

<style lang="scss" scoped>
.empty-state {
  padding: 40px 0;
}
</style>
