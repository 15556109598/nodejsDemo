<script setup lang="ts">
// 登录/注册页：渐变头部 + 白卡表单
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const active = ref(0) // 0 登录 / 1 注册
const submitting = ref(false)

const loginForm = reactive({ email: '', password: '' })
const regForm = reactive({ email: '', password: '', nickname: '' })

// 邮箱格式校验
const emailPattern = /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/

function doLogin() {
  submitting.value = true
  userStore
    .login({ email: loginForm.email, password: loginForm.password })
    .then(() => {
      showToast('登录成功')
      router.replace((route.query.redirect as string) || '/app')
    })
    .catch(() => undefined)
    .finally(() => (submitting.value = false))
}

function doRegister() {
  submitting.value = true
  userStore
    .register({ email: regForm.email, password: regForm.password, nickname: regForm.nickname })
    .then(() => {
      showToast('注册成功，欢迎加入小厨~')
      router.replace((route.query.redirect as string) || '/app')
    })
    .catch(() => undefined)
    .finally(() => (submitting.value = false))
}

function onSubmit() {
  if (submitting.value) return
  if (active.value === 0) doLogin()
  else doRegister()
}
</script>

<template>
  <div class="login-page">
    <!-- 渐变头部 -->
    <div class="hero">
      <div class="logo">
        <van-icon name="shop-o" size="34" color="#fff" />
      </div>
      <div class="name">jump jump</div>
      <div class="slogan">新鲜现炒 · 堂食更香 · 积分享好礼</div>
    </div>

    <!-- 白卡表单 -->
    <div class="form-card">
      <van-tabs v-model:active="active" shrink>
        <van-tab title="登录" />
        <van-tab title="注册" />
      </van-tabs>

      <!-- 登录表单 -->
      <van-form v-if="active === 0" class="form" @submit="onSubmit">
        <van-field
          v-model="loginForm.email"
          name="email"
          label="邮箱"
          placeholder="请输入邮箱"
          :rules="[
            { required: true, message: '请输入邮箱' },
            { validator: (v: string) => emailPattern.test(v), message: '邮箱格式不正确' },
          ]"
        />
        <van-field
          v-model="loginForm.password"
          name="password"
          label="密码"
          type="password"
          placeholder="请输入密码"
          :rules="[
            { required: true, message: '请输入密码' },
            { validator: (v: string) => v.length >= 6, message: '密码至少 6 位' },
          ]"
        />
        <div class="submit-wrap">
          <button class="submit-btn press" native-type="submit" :disabled="submitting">
            {{ submitting ? '登录中...' : '登录' }}
          </button>
        </div>
      </van-form>

      <!-- 注册表单 -->
      <van-form v-else class="form" @submit="onSubmit">
        <van-field
          v-model="regForm.email"
          name="email"
          label="邮箱"
          placeholder="请输入邮箱"
          :rules="[
            { required: true, message: '请输入邮箱' },
            { validator: (v: string) => emailPattern.test(v), message: '邮箱格式不正确' },
          ]"
        />
        <van-field
          v-model="regForm.password"
          name="password"
          label="密码"
          type="password"
          placeholder="设置密码（至少 6 位）"
          :rules="[
            { required: true, message: '请输入密码' },
            { validator: (v: string) => v.length >= 6, message: '密码至少 6 位' },
          ]"
        />
        <van-field
          v-model="regForm.nickname"
          name="nickname"
          label="昵称"
          placeholder="给自己起个名字吧"
          :rules="[{ required: true, message: '请输入昵称' }]"
        />
        <div class="submit-wrap">
          <button class="submit-btn press" native-type="submit" :disabled="submitting">
            {{ submitting ? '注册中...' : '注册并登录' }}
          </button>
        </div>
      </van-form>
    </div>

    <div class="footer-tip hint-text">登录即代表同意《用户协议》与《隐私政策》</div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: $bg-page;
}

.hero {
  padding: calc(60px + env(safe-area-inset-top)) 0 70px;
  background: $primary-gradient;
  text-align: center;
  border-radius: 0 0 30px 30px;

  .logo {
    width: 76px;
    height: 76px;
    margin: 0 auto 14px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .name {
    font-size: 26px;
    font-weight: $font-bold;
    color: #fff;
    letter-spacing: 2px;
  }

  .slogan {
    margin-top: 6px;
    font-size: $font-sm;
    color: rgba(255, 255, 255, 0.9);
  }
}

.form-card {
  margin: -40px 16px 0;
  padding-bottom: 8px;
  background: #fff;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
  overflow: hidden;

  :deep(.van-tabs__nav) {
    background: transparent;
  }

  .form {
    padding: 20px 8px 8px;
  }
}

.submit-wrap {
  padding: 20px 16px 12px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: $radius-full;
  background: $primary-gradient;
  color: #fff;
  font-size: 16px;
  font-weight: $font-medium;

  &:disabled {
    opacity: 0.6;
  }
}

.footer-tip {
  margin-top: 20px;
  text-align: center;
}
</style>
