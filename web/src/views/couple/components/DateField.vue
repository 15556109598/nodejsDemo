<script setup lang="ts">
// 日期选择：统一的触发器 + 底部日期弹层
// 替代各浏览器表现不一致的原生 input[type=date]（占位符/日历图标/宽度各不相同）
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { DatePicker, Popup } from 'vant'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    title?: string
    placeholder?: string
    minDate?: Date
    maxDate?: Date
    clearable?: boolean
  }>(),
  {
    title: '选择日期',
    placeholder: '请选择日期',
    minDate: () => new Date(1900, 0, 1),
    maxDate: () => new Date(2100, 11, 31),
    clearable: false,
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const show = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const pickerValue = ref<string[]>([])

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function partsOf(value: string): string[] {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (matched) return [matched[1], matched[2], matched[3]]
  const now = new Date()
  return [String(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())]
}

const displayText = computed(() => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.modelValue || '')
  if (!matched) return ''
  return `${matched[1]} 年 ${Number(matched[2])} 月 ${Number(matched[3])} 日`
})

// 打开时把当前值（或今天）夹在可选范围内，避免越界列出现空白
function initialPickerValue(): string[] {
  const base = partsOf(props.modelValue)
  const date = new Date(Number(base[0]), Number(base[1]) - 1, Number(base[2]))
  const min = props.minDate
  const max = props.maxDate
  const bounded = new Date(Math.min(Math.max(date.getTime(), min.getTime()), max.getTime()))
  return [String(bounded.getFullYear()), pad(bounded.getMonth() + 1), pad(bounded.getDate())]
}

function open(): void {
  pickerValue.value = initialPickerValue()
  show.value = true
}

function close(): void {
  show.value = false
}

function onConfirm({ selectedValues }: { selectedValues: string[] }): void {
  emit('update:modelValue', selectedValues.join('-'))
  show.value = false
}

function clear(): void {
  emit('update:modelValue', '')
}

function onEsc(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(show, (value) => {
  if (value) {
    window.addEventListener('keydown', onEsc)
  } else {
    window.removeEventListener('keydown', onEsc)
    nextTick(() => triggerRef.value?.focus())
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))
</script>

<template>
  <div class="date-field" :class="{ 'is-empty': !displayText }">
    <button
      ref="triggerRef"
      type="button"
      class="date-field__trigger"
      :aria-label="`${label}，${displayText || placeholder}`"
      :aria-haspopup="'dialog'"
      @click="open"
    >
      <svg class="date-field__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" stroke="currentColor" stroke-width="1.6" />
        <path d="M3.5 10h17M8 3.5v3M16 3.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <span class="date-field__text">{{ displayText || placeholder }}</span>
      <svg class="date-field__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button
      v-if="clearable && displayText"
      type="button"
      class="date-field__clear"
      aria-label="清除日期"
      @click.stop="clear"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>

    <Popup
      v-model:show="show"
      position="bottom"
      round
      teleport="body"
      class="couple-sheet date-sheet"
      safe-area-inset-bottom
      :style="{ maxHeight: '70vh' }"
      close-on-click-overlay
    >
      <DatePicker
        v-model="pickerValue"
        :columns-type="['year', 'month', 'day']"
        :title="title"
        :min-date="minDate"
        :max-date="maxDate"
        confirm-button-text="确定"
        cancel-button-text="取消"
        @confirm="onConfirm"
        @cancel="close"
      />
    </Popup>
  </div>
</template>

<style scoped lang="scss">
.date-field {
  position: relative;
}

.date-field__trigger {
  display: flex;
  align-items: center;
  gap: 8PX;
  width: 100%;
  min-height: 44PX;
  padding: 0 44PX 0 12PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  color: $ink;
  font-size: 14PX;
  text-align: left;
  cursor: pointer;
  transition: border-color $motion-fast $ease-standard, background-color $motion-fast $ease-standard;

  &:hover {
    border-color: $line-strong;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.date-field__icon {
  flex: none;
  color: $ink-muted;
}

.date-field__text {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.date-field.is-empty .date-field__text {
  color: $placeholder;
}

.date-field__chevron {
  flex: none;
  color: $ink-muted;
}

.date-field__clear {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44PX;
  height: 44PX;
  background: transparent;
  border: none;
  color: $ink-muted;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: -4PX;
    border-radius: 12PX;
  }
}
</style>
