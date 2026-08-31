<script setup lang="ts">
// 评价弹层：评分星星 + 100 字评价
import { ref, watch } from 'vue'
import { showToast } from 'vant'
import { orderApi } from '@/api'

const props = defineProps<{ visible: boolean; orderId: number | null }>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'success'): void
}>()

const rating = ref(0)
const content = ref('')
const submitting = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      rating.value = 0
      content.value = ''
    }
  }
)

function close() {
  emit('update:visible', false)
}

async function submit() {
  if (submitting.value) return
  if (!props.orderId) return
  if (rating.value < 1) {
    showToast('请先评分哦~')
    return
  }
  submitting.value = true
  try {
    await orderApi.review(props.orderId, { rating: rating.value, content: content.value })
    showToast('评价成功，感谢反馈')
    close()
    emit('success')
  } catch {
    // 错误已在拦截器统一提示
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <van-popup
    :show="props.visible"
    position="bottom"
    round
    :style="{ borderRadius: '20px 20px 0 0' }"
    @update:show="(v: boolean) => emit('update:visible', v)"
  >
    <div class="review-sheet safe-bottom">
      <div class="title">评价本单</div>

      <div class="rate-wrap">
        <van-rate v-model="rating" :size="24" color="#FF6B35" void-color="#EBEDF0" allow-half />
      </div>

      <van-field
        v-model="content"
        type="textarea"
        rows="3"
        autosize
        maxlength="100"
        show-word-limit
        placeholder="这次用餐体验如何？说说菜品口味、出餐速度吧~"
        class="content-field"
      />

      <div class="submit-wrap">
        <button class="submit-btn press" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中...' : '发布评价' }}
        </button>
      </div>
    </div>
  </van-popup>
</template>

<style lang="scss" scoped>
.review-sheet {
  padding: 20px 16px 16px;
}

.title {
  font-size: 18px;
  font-weight: $font-bold;
  text-align: center;
}

.rate-wrap {
  display: flex;
  justify-content: center;
  padding: 20px 0;

  :deep(.van-rate__icon),
  :deep(.van-rate__item) {
    transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  :deep(.van-rate__item:active) {
    transform: scale(1.25);
  }
}

.content-field {
  background: #f7f8fa;
  border-radius: $radius-md;
  padding: 10px;
}

.submit-wrap {
  padding: 16px 0 4px;
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
</style>
