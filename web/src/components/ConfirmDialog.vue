<script setup lang="ts">
// 通用确认弹窗：aria-modal + Esc 关闭 + 焦点陷阱 + 关闭后焦点归还
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    show: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
  }>(),
  { confirmText: '确定', cancelText: '取消', danger: false }
)

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const uid = `confirm-${Math.random().toString(36).slice(2, 8)}`
const dialogRef = ref<HTMLElement | null>(null)
const confirmRef = ref<HTMLButtonElement | null>(null)
let lastActive: HTMLElement | null = null

function close() {
  emit('update:show', false)
  emit('cancel')
}

function confirm() {
  emit('update:show', false)
  emit('confirm')
}

// Esc 关闭 + Tab 在弹窗内循环
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key !== 'Tab') return
  const root = dialogRef.value
  if (!root) return
  const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'))
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      lastActive = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown, true)
      await nextTick()
      confirmRef.value?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      lastActive?.focus()
    }
  }
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <teleport to="body">
    <transition name="confirm">
      <div v-if="show" class="confirm-layer">
        <div class="confirm-mask" @click="close" />
        <div
          ref="dialogRef"
          class="confirm-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${uid}-title`"
          :aria-describedby="`${uid}-desc`"
        >
          <h2 :id="`${uid}-title`" class="confirm-title">{{ title }}</h2>
          <p :id="`${uid}-desc`" class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button type="button" class="btn btn-ghost" @click="close">{{ cancelText }}</button>
            <button
              ref="confirmRef"
              type="button"
              class="btn"
              :class="danger ? 'btn-danger' : 'btn-primary'"
              @click="confirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped lang="scss">
.confirm-layer {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24PX;
}

.confirm-mask {
  position: absolute;
  inset: 0;
  background: rgba(24, 20, 17, 0.45);
}

.confirm-dialog {
  position: relative;
  width: 320PX;
  max-width: calc(100% - 48PX);
  padding: 20PX;
  background: $surface;
  border-radius: 12PX;
  box-shadow: 0 16PX 48PX rgba(24, 20, 17, 0.24);
}

.confirm-title {
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.3;
  color: $ink;
}

.confirm-message {
  margin-top: 8PX;
  font-size: 14PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.confirm-actions {
  display: flex;
  gap: 8PX;
  margin-top: 20PX;
}

.btn {
  flex: 1;
  min-height: 44PX;
  padding: 0 14PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;
  transition: background $motion-fast $ease-standard, border-color $motion-fast $ease-standard;
}

.btn-ghost {
  color: $ink-secondary;
  background: $surface;

  &:active {
    background: $bg-warm;
  }
}

.btn-primary {
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;

  &:active {
    background: $brand-action-dark;
  }
}

.btn-danger {
  color: #fff;
  background: $danger-text;
  border-color: $danger-text;

  &:active {
    background: #94101b;
  }
}

.confirm-enter-active,
.confirm-leave-active {
  transition: opacity $motion-base $ease-standard;

  .confirm-dialog {
    transition: transform $motion-base $ease-standard;
  }
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;

  .confirm-dialog {
    transform: translateY(8PX) scale(0.98);
  }
}
</style>
