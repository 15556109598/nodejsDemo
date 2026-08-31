<script setup lang="ts">
// 应用根组件：路由过渡 + 全局底部标签栏
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <keep-alive include="Home">
        <component :is="Component" />
      </keep-alive>
    </transition>
  </router-view>

  <!-- 三大 Tab：仅 tab 页显示 -->
  <van-tabbar v-if="route.meta.tabbar" route safe-area-inset-bottom>
    <van-tabbar-item to="/" icon="shop-o">点餐</van-tabbar-item>
    <van-tabbar-item to="/order" icon="orders-o">订单</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>
</template>
