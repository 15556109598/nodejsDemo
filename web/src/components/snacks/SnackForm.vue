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
  padding: 20px 0 0;
  background: $bg-page;
  border-radius: $radius-lg $radius-lg 0 0;
}

.form-title {
  padding: 0 20px 14px;
  font-size: $font-lg;
  font-weight: $font-bold;
  color: $text-primary;
}

.form-scroll {
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}

.photo-block {
  padding: 0 16px 14px;
}

.photo-trigger {
  width: 88px;
  height: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: $text-hint;
  font-size: $font-xs;
  background: $bg-card;
  border-radius: $radius-sm;
  border: 1px dashed $border;
}

.photo-hint {
  margin-top: 8px;
  font-size: $font-xs;
  color: $text-hint;
}

.form-actions {
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
}
</style>
