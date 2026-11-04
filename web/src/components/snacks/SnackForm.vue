<script setup lang="ts">
// 零食新增 / 编辑表单（底部弹层）
import { ref, watch } from 'vue'
import { showToast } from 'vant'
import type { UploaderFileListItem } from 'vant'
import { resolveUploadUrl, uploadSnackPhoto, type SnackItem, type SnackPayload } from '@/api/snacks'

const props = defineProps<{
  modelValue: boolean
  item: SnackItem | null
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: SnackPayload): void
}>()

const name = ref('')
const brand = ref('')
const quantity = ref(1)
const expireDate = ref('')
const note = ref('')
const photoUrl = ref('')

const fileList = ref<UploaderFileListItem[]>([])
const uploading = ref(false)

const datePickerVisible = ref(false)
const dateValue = ref<string[]>([])

const minDate = new Date(new Date().getFullYear() - 5, 0, 1)
const maxDate = new Date(new Date().getFullYear() + 10, 11, 31)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 打开弹层时按「新增 / 编辑」初始化
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    const it = props.item
    name.value = it?.name || ''
    brand.value = it?.brand || ''
    quantity.value = it?.quantity || 1
    expireDate.value = it?.expireDate || todayStr()
    note.value = it?.note || ''
    photoUrl.value = it?.photoUrl || ''
    fileList.value = it?.photoUrl ? [{ url: resolveUploadUrl(it.photoUrl), isImage: true }] : []
    dateValue.value = expireDate.value.split('-')
    uploading.value = false
  }
)

// 压缩图片：最长边 1600px、JPEG 0.85，减少上传体积
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const maxSide = 1600
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }
    img.src = objectUrl
  })
}

async function onAfterRead(file: UploaderFileListItem | UploaderFileListItem[]) {
  const target = Array.isArray(file) ? file[0] : file
  if (!target?.file) return
  uploading.value = true
  try {
    const blob = await compressImage(target.file)
    const res = await uploadSnackPhoto(blob)
    photoUrl.value = res.url
    showToast('图片已上传')
  } catch {
    // 错误提示由请求拦截器统一处理
    fileList.value = []
    photoUrl.value = ''
  } finally {
    uploading.value = false
  }
}

function onPhotoDelete() {
  photoUrl.value = ''
}

function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  expireDate.value = selectedValues.join('-')
  datePickerVisible.value = false
}

function onSubmit() {
  if (!name.value.trim()) {
    showToast('请填写零食名称')
    return
  }
  if (!expireDate.value) {
    showToast('请选择到期日期')
    return
  }
  if (uploading.value) {
    showToast('图片上传中，请稍候')
    return
  }
  emit('submit', {
    name: name.value.trim(),
    brand: brand.value.trim(),
    quantity: Number(quantity.value) || 1,
    expireDate: expireDate.value,
    note: note.value.trim(),
    photoUrl: photoUrl.value,
  })
}
</script>

<template>
  <van-popup
    :show="modelValue"
    position="bottom"
    round
    closeable
    class="snack-form-popup"
    :style="{ maxHeight: '92%' }"
    @update:show="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="form-wrap">
      <h2 class="form-title">{{ item ? '编辑零食' : '添加零食' }}</h2>

      <div class="form-scroll">
        <div class="photo-block">
          <van-uploader
            v-model="fileList"
            :max-count="1"
            :after-read="onAfterRead"
            :deletable="true"
            accept="image/*"
            :preview-image="true"
            aria-label="上传零食照片"
            @delete="onPhotoDelete"
          >
            <div class="photo-trigger">
              <van-icon name="photograph" size="22" />
              <span>零食照片</span>
            </div>
          </van-uploader>
          <p class="photo-hint">支持 JPG / PNG / WEBP / GIF，建议 5MB 以内（自动压缩）</p>
        </div>

        <van-cell-group inset>
          <van-field v-model="name" label="名称" placeholder="例如：巧克力威化" maxlength="50" required />
          <van-field v-model="brand" label="品类/品牌" placeholder="例如：奥利奥 / 饼干" maxlength="50" />
          <van-field label="数量">
            <template #input>
              <van-stepper v-model="quantity" min="1" max="999" integer />
            </template>
          </van-field>
          <van-field
            v-model="expireDate"
            label="到期日"
            readonly
            is-link
            placeholder="请选择保质期到期日期"
            @click="datePickerVisible = true"
          />
          <van-field
            v-model="note"
            label="备注"
            type="textarea"
            rows="2"
            autosize
            maxlength="200"
            show-word-limit
            placeholder="存放位置、口味等（选填）"
          />
        </van-cell-group>

        <div class="form-actions">
          <van-button round block type="primary" :loading="submitting" @click="onSubmit">
            {{ item ? '保存修改' : '添加到清单' }}
          </van-button>
        </div>
      </div>
    </div>

    <!-- 日期选择（独立弹层，避免被表单弹层裁剪） -->
    <van-popup
      v-model:show="datePickerVisible"
      position="bottom"
      round
      teleport="body"
      class="date-popup"
      :style="{ zIndex: 2200 }"
    >
      <van-date-picker
        v-model="dateValue"
        title="选择到期日期"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="onDateConfirm"
        @cancel="datePickerVisible = false"
      />
    </van-popup>
  </van-popup>
</template>

<style scoped lang="scss">
.form-wrap {
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  padding: 20PX 0 0;
  background: $bg-warm;
  border-radius: 20PX 20PX 0 0;
  // 固定组件内部尺寸，避免桌面端被 px→vw 放大（大写 PX 不参与转换）
  --van-cell-font-size: 14PX;
  --van-cell-line-height: 24PX;
  --van-cell-vertical-padding: 12PX;
  --van-cell-horizontal-padding: 16PX;
  --van-field-label-color: #{$ink-secondary};
  --van-field-input-text-color: #{$ink};
  --van-stepper-input-height: 44PX;
  --van-stepper-button-width: 44PX;
  --van-stepper-input-width: 56PX;
  --van-stepper-input-font-size: 14PX;
  --van-button-default-height: 44PX;
  // Vant 的字号/图标尺寸默认基于被 vw 化的 --van-font-size-*，逐项钉住
  --van-field-word-limit-font-size: 12PX;
  --van-cell-icon-size: 16PX;

  :deep(.van-uploader__input-wrapper) {
    display: block;
  }

  :deep(.van-button--primary) {
    height: 48PX;
    font-size: 16PX;
    font-weight: 500;
    border: none;
    border-radius: 12PX;
    background: $brand-action;
  }
}

.form-title {
  padding: 0 20PX 14PX;
  font-size: 18PX;
  font-weight: 700;
  line-height: 1.25;
  color: $ink;
}

.form-scroll {
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}

.photo-block {
  padding: 0 16PX 14PX;
}

.photo-trigger {
  width: 88PX;
  height: 88PX;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4PX;
  color: $ink-muted;
  font-size: 12PX;
  background: $surface;
  border-radius: 12PX;
  border: 1PX dashed $line;
}

.photo-hint {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.form-actions {
  padding: 20PX 16PX calc(20PX + env(safe-area-inset-bottom));
}

// 弹层右上角关闭按钮：Vant 默认 23×23，且位于 .form-wrap 之外（同级），
// 因此这条必须放在顶层（不能嵌在 .form-wrap 里），并放大到 44×44。
:deep(.van-popup__close-icon) {
  width: 44PX;
  height: 44PX;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20PX;
  color: $ink-muted;
}

// 日期选择弹层：teleport 到 body（根元素仍带本组件的 scopeId），
// 内部 Vant 变量被 vw 化，需要逐项钉住，否则桌面 1440 会放大到 3.84 倍
.date-popup {
  font-size: 14PX;
  --van-picker-toolbar-height: 44PX;
  --van-picker-title-font-size: 18PX;
  --van-picker-action-font-size: 14PX;
  --van-picker-option-font-size: 16PX;

  :deep(.van-picker__title) {
    line-height: 44PX;
  }

  :deep(.van-picker-column__item) {
    height: 44PX;
    line-height: 44PX;
  }
}

// 桌面：底部弹层收成与内容同宽（760PX）居中，不再拉满整屏
@media (min-width: 768px) {
  .snack-form-popup,
  .date-popup {
    left: 50%;
    right: auto;
    width: $content-max;
    margin-left: calc($content-max / -2);
    border-radius: 16PX 16PX 0 0;
    overflow: hidden;
  }
}
</style>
