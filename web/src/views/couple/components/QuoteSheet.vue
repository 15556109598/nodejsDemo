<script setup lang="ts">
// 「指定今天的句子」弹层：从内置句库或自定义句子里选一条，只对今天生效
import { computed, ref, watch } from 'vue'
import { Popup } from 'vant'
import { CoupleApiError, coupleApi, type CoupleQuote, type DailyQuoteState } from '@/api/couple'

const props = defineProps<{
  show: boolean
  current: DailyQuoteState
}>()

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
  (event: 'updated', quote: DailyQuoteState): void
}>()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const builtin = ref<string[]>([])
const custom = ref<CoupleQuote[]>([])
const selected = ref('')
const sheetRef = ref<HTMLElement | null>(null)

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const hasSelection = computed(() => Boolean(selected.value) && selected.value !== props.current.content)

function errorMessage(value: unknown): string {
  if (value instanceof CoupleApiError) return value.message
  if (value instanceof Error && value.message) return value.message
  return '操作失败，请稍后重试'
}

async function loadPool(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const pool = await coupleApi.quotePool()
    builtin.value = pool.builtin
    custom.value = pool.custom
    selected.value = props.current.content
  } catch (value) {
    error.value = errorMessage(value)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (value) => {
    if (value) {
      loadPool()
      requestAnimationFrame(() => {
        const first = sheetRef.value?.querySelector('.quote-option') as HTMLElement | null
        first?.focus()
      })
    }
  }
)

function close(): void {
  emit('update:show', false)
}

async function confirm(): Promise<void> {
  if (!hasSelection.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await coupleApi.setTodayQuote(selected.value)
    emit('updated', result.quote)
    close()
  } catch (value) {
    error.value = errorMessage(value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Popup
    v-model:show="visible"
    position="bottom"
    round
    teleport="body"
    class="couple-sheet quote-sheet"
    safe-area-inset-bottom
    :style="{ maxHeight: '80vh' }"
    close-on-click-overlay
    @closed="error = ''"
  >
    <div ref="sheetRef" class="quote-picker" role="dialog" aria-labelledby="quote-sheet-title">
      <div class="sheet-head">
        <h3 id="quote-sheet-title">指定今天的句子</h3>
        <button type="button" class="sheet-close" aria-label="关闭" @click="close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <p class="sheet-note">只对今天生效，明天会自动回到每日轮换。</p>

      <div class="sheet-body">
        <p v-if="loading" class="sheet-state">正在读取句库…</p>
        <p v-else-if="error" class="sheet-state is-error" role="alert">{{ error }}</p>
        <template v-else>
          <p class="group-title">内置句库</p>
          <ul class="quote-options">
            <li v-for="item in builtin" :key="item">
              <button
                type="button"
                class="quote-option"
                :class="{ 'is-selected': selected === item }"
                :aria-pressed="selected === item"
                @click="selected = item"
              >
                <span class="quote-option__text">{{ item }}</span>
                <svg v-if="selected === item" class="quote-option__check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </li>
          </ul>

          <p v-if="custom.length" class="group-title">自定义句子</p>
          <ul v-if="custom.length" class="quote-options">
            <li v-for="item in custom" :key="item.id">
              <button
                type="button"
                class="quote-option"
                :class="{ 'is-selected': selected === item.content }"
                :aria-pressed="selected === item.content"
                @click="selected = item.content"
              >
                <span class="quote-option__text">{{ item.content }}</span>
                <svg v-if="selected === item.content" class="quote-option__check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </li>
          </ul>
        </template>
      </div>

      <footer class="sheet-foot">
        <p v-if="!loading && !error" class="sheet-hint">{{ hasSelection ? '' : '选中的就是今天显示的那一句' }}</p>
        <button type="button" class="btn btn-primary" :disabled="!hasSelection || saving || loading" @click="confirm">
          {{ saving ? '保存中…' : '设为今天' }}
        </button>
      </footer>
    </div>
  </Popup>
</template>

<style scoped lang="scss">
.quote-picker {
  display: flex;
  flex-direction: column;
  max-height: 78vh;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8PX;
  padding: 14PX 16PX 8PX;

  h3 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }
}

.sheet-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44PX;
  height: 44PX;
  margin-right: -12PX;
  color: $ink-muted;
  background: transparent;
  border: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: -4PX;
    border-radius: 12PX;
  }
}

.sheet-note {
  padding: 0 16PX 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.sheet-body {
  flex: 1;
  min-height: 120PX;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 16PX;
}

.sheet-state {
  padding: 24PX 0;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-muted;

  &.is-error {
    color: $danger-text;
  }
}

.group-title {
  margin: 10PX 0 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
  letter-spacing: 0.4PX;
}

.quote-options {
  display: flex;
  flex-direction: column;
  gap: 6PX;
  margin-bottom: 6PX;
}

.quote-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10PX;
  width: 100%;
  min-height: 44PX;
  padding: 10PX 12PX;
  text-align: left;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  color: $ink;
  font-size: 14PX;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color $motion-fast $ease-standard, border-color $motion-fast $ease-standard;

  &:hover {
    border-color: $line-strong;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &.is-selected {
    background: $accent-soft;
    border-color: $accent-line;
  }
}

.quote-option__text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.quote-option__check {
  flex: none;
  color: $brand-action;
}

.sheet-foot {
  padding: 10PX 16PX calc(12PX + env(safe-area-inset-bottom));
  border-top: 1PX solid $line-soft;
}

.sheet-hint {
  margin-bottom: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.btn {
  width: 100%;
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $brand-action;
  color: #fff;
  background: $brand-action;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}
</style>
