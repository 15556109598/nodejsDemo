<script setup lang="ts">
// 头像裁剪：固定方形取景框 + 拖动 + 缩放，导出 512×512 JPEG（顺带压缩）
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Popup, showToast } from 'vant'

const props = defineProps<{
  show: boolean
  file: File | null
}>()

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
  (event: 'cropped', blob: Blob): void
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const stageRef = ref<HTMLElement | null>(null)
const imageUrl = ref('')
const imageSize = ref({ width: 0, height: 0 })
const stageSize = ref(280)
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })
const ready = ref(false)
const failed = ref(false)
const exporting = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)

// cover 基准缩放：图片刚好铺满取景框
const baseScale = computed(() => {
  const { width, height } = imageSize.value
  if (!width || !height) return 1
  return Math.max(stageSize.value / width, stageSize.value / height)
})

const scale = computed(() => baseScale.value * zoom.value)

const imageStyle = computed(() => ({
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
}))

function clampOffset(): void {
  const displayedW = imageSize.value.width * scale.value
  const displayedH = imageSize.value.height * scale.value
  const maxX = Math.max(0, (displayedW - stageSize.value) / 2)
  const maxY = Math.max(0, (displayedH - stageSize.value) / 2)
  offset.value = {
    x: Math.min(maxX, Math.max(-maxX, offset.value.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.value.y)),
  }
}

function loadFile(file: File | null): void {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  imageSize.value = { width: 0, height: 0 }
  zoom.value = 1
  offset.value = { x: 0, y: 0 }
  ready.value = false
  failed.value = false
  if (!file) return
  imageUrl.value = URL.createObjectURL(file)
}

watch(
  () => props.file,
  (file) => loadFile(file)
)

watch(
  () => props.show,
  async (value) => {
    if (!value) {
      loadFile(null)
      return
    }
    await nextTick()
    stageSize.value = stageRef.value?.clientWidth || 280
    clampOffset()
  }
)

function onImageLoad(): void {
  const img = imgRef.value
  if (!img) return
  imageSize.value = { width: img.naturalWidth, height: img.naturalHeight }
  ready.value = true
  clampOffset()
}

function onImageError(): void {
  failed.value = true
  ready.value = false
}

// 拖动
let dragging = false
let start = { x: 0, y: 0 }
let origin = { x: 0, y: 0 }

function onPointerDown(event: PointerEvent): void {
  if (!ready.value) return
  dragging = true
  start = { x: event.clientX, y: event.clientY }
  origin = { ...offset.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging) return
  offset.value = { x: origin.x + (event.clientX - start.x), y: origin.y + (event.clientY - start.y) }
  clampOffset()
}

function onPointerUp(): void {
  dragging = false
}

function onZoom(value: number | number[]): void {
  zoom.value = Array.isArray(value) ? value[0] : value
  clampOffset()
}

function close(): void {
  if (exporting.value) return
  emit('update:show', false)
}

async function confirm(): Promise<void> {
  const img = imgRef.value
  if (!img || !ready.value || exporting.value) return
  exporting.value = true
  try {
    const output = 512
    const canvas = document.createElement('canvas')
    canvas.width = output
    canvas.height = output
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布')
    const s = scale.value
    const view = stageSize.value
    const sx = imageSize.value.width / 2 - view / (2 * s) - offset.value.x / s
    const sy = imageSize.value.height / 2 - view / (2 * s) - offset.value.y / s
    const sw = view / s
    const sh = view / s
    context.fillStyle = '#F6F4F0'
    context.fillRect(0, 0, output, output)
    context.drawImage(img, sx, sy, sw, sh, 0, 0, output, output)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob) throw new Error('图片处理失败')
    emit('cropped', blob)
    emit('update:show', false)
  } catch (error) {
    showToast(error instanceof Error && error.message ? error.message : '裁剪失败，请重试')
  } finally {
    exporting.value = false
  }
}

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <Popup
    v-model:show="visible"
    position="center"
    round
    teleport="body"
    class="couple-sheet cropper-popup"
    :close-on-click-overlay="!exporting"
  >
    <div class="cropper" role="dialog" aria-labelledby="cropper-title">
      <h3 id="cropper-title">调整头像</h3>
      <p class="cropper-note">拖动图片选择位置，滑块调整大小，保存后会压缩到 512×512。</p>

      <div ref="stageRef" class="cropper-stage">
        <div v-if="failed" class="cropper-fallback">图片读取失败，请换一张</div>
        <img
          v-else
          ref="imgRef"
          class="cropper-img"
          :src="imageUrl"
          alt="待裁剪的头像"
          draggable="false"
          :style="imageStyle"
          @load="onImageLoad"
          @error="onImageError"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        />
        <div class="cropper-frame" aria-hidden="true" />
      </div>

      <label class="cropper-zoom">
        <span>缩放</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.02"
          :value="zoom"
          aria-label="调整头像缩放"
          @input="onZoom(Number(($event.target as HTMLInputElement).value))"
        />
      </label>

      <div class="cropper-actions">
        <button type="button" class="btn btn-ghost" :disabled="exporting" @click="close">取消</button>
        <button type="button" class="btn btn-primary" :disabled="!ready || exporting" @click="confirm">
          {{ exporting ? '处理中…' : '保存头像' }}
        </button>
      </div>
    </div>
  </Popup>
</template>

<style scoped lang="scss">
.cropper {
  width: min(86vw, 360PX);
  padding: 18PX 16PX calc(16PX + env(safe-area-inset-bottom));

  h3 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }
}

.cropper-note {
  margin-top: 4PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.cropper-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  margin-top: 12PX;
  overflow: hidden;
  background: $surface-sunken;
  border-radius: 12PX;
  touch-action: none;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.cropper-img {
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: none;
  transform-origin: center;
  user-select: none;
}

.cropper-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 13PX;
  color: $ink-muted;
}

.cropper-frame {
  position: absolute;
  inset: 8%;
  border: 1PX dashed rgba(36, 31, 27, 0.35);
  border-radius: 8PX;
  pointer-events: none;
}

.cropper-zoom {
  display: flex;
  align-items: center;
  gap: 10PX;
  margin-top: 12PX;
  font-size: 13PX;
  color: $ink-secondary;

  input {
    flex: 1;
    min-height: 44PX;
    accent-color: $brand-action;
  }
}

.cropper-actions {
  display: flex;
  gap: 8PX;
  margin-top: 8PX;

  .btn {
    flex: 1;
  }
}

.btn {
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.btn-primary {
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;
}

.btn-ghost {
  color: $ink-secondary;
  background: $surface;
}
</style>
