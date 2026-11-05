<script setup lang="ts">
// 单人资料：名字 / 头像（裁剪压缩上传）/ 当前状态（预设或自定义短句）
import { computed, ref, watch } from 'vue'
import { Popup, showToast } from 'vant'
import { CoupleApiError, coupleApi, type CoupleProfile } from '@/api/couple'
import AvatarCropper from './AvatarCropper.vue'

const props = defineProps<{
  show: boolean
  profile: CoupleProfile | null
  today: string
}>()

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
  (event: 'updated', profile: CoupleProfile): void
}>()

const PRESETS = ['想你了', '在忙', '已睡', '吃饭中', '在路上', '有点累']

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const name = ref('')
const statusText = ref('')
const statusPreset = ref('')
const avatarUrl = ref('')
const avatarFailed = ref(false)
const avatarBusy = ref(false)
const saving = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const cropperOpen = ref(false)
const pendingFile = ref<File | null>(null)

watch(
  () => props.show,
  (value) => {
    if (!value) return
    const profile = props.profile
    name.value = profile?.displayName || ''
    statusText.value = profile?.statusText || ''
    statusPreset.value = profile?.statusPreset || ''
    avatarUrl.value = profile?.avatarUrl || ''
    avatarFailed.value = false
    error.value = ''
  },
  { immediate: true }
)

const title = computed(() => `设置「${props.profile?.displayName || '这位'}」`)

const updatedText = computed(() => {
  const raw = props.profile?.statusUpdatedAt
  if (!raw) return '还没有设置状态'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '刚刚更新'
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  return sameDay ? `今天 ${hm} 更新` : `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${hm} 更新`
})

function errorMessage(value: unknown): string {
  if (value instanceof CoupleApiError) return value.message
  if (value instanceof Error && value.message) return value.message
  return '操作失败，请稍后重试'
}

function applyPreset(preset: string): void {
  statusPreset.value = preset
  statusText.value = preset
  error.value = ''
}

function onStatusInput(): void {
  if (statusText.value.trim() !== statusPreset.value) statusPreset.value = ''
}

function openCropper(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  input.value = ''
  if (!file) return
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    showToast('头像仅支持 JPG / PNG / WEBP')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('原图不要超过 10MB')
    return
  }
  pendingFile.value = file
  cropperOpen.value = true
}

async function uploadCropped(blob: Blob): Promise<void> {
  const slot = props.profile?.slot
  if (!slot) return
  avatarBusy.value = true
  error.value = ''
  try {
    const result = await coupleApi.uploadAvatar(slot, blob)
    avatarUrl.value = result.profile.avatarUrl
    avatarFailed.value = false
    emit('updated', result.profile)
    showToast('头像已更新')
  } catch (value) {
    error.value = errorMessage(value)
  } finally {
    avatarBusy.value = false
  }
}

async function removeAvatar(): Promise<void> {
  const slot = props.profile?.slot
  if (!slot || avatarBusy.value) return
  avatarBusy.value = true
  error.value = ''
  try {
    const result = await coupleApi.removeAvatar(slot)
    avatarUrl.value = ''
    emit('updated', result.profile)
    showToast('已移除头像')
  } catch (value) {
    error.value = errorMessage(value)
  } finally {
    avatarBusy.value = false
  }
}

async function save(): Promise<void> {
  const slot = props.profile?.slot
  if (!slot || saving.value) return
  if (!name.value.trim()) {
    error.value = '名字不能为空'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const result = await coupleApi.updateProfile(slot, {
      displayName: name.value.trim(),
      statusText: statusText.value.trim(),
      statusPreset: statusPreset.value,
    })
    emit('updated', result.profile)
    emit('update:show', false)
    showToast('已保存')
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
    class="couple-sheet profile-sheet"
    safe-area-inset-bottom
    :style="{ maxHeight: '88vh' }"
    close-on-click-overlay
  >
    <div class="profile-panel" role="dialog" aria-labelledby="profile-sheet-title">
      <div class="sheet-head">
        <h3 id="profile-sheet-title">{{ title }}</h3>
        <button type="button" class="sheet-close" aria-label="关闭" @click="visible = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="profile-body">
        <div class="avatar-block">
          <div class="avatar-preview" :class="{ 'is-busy': avatarBusy }">
            <img
              v-if="avatarUrl && !avatarFailed"
              :src="avatarUrl"
              :alt="`${name || 'TA'}的头像`"
              @error="avatarFailed = true"
            />
            <svg v-else viewBox="0 0 64 64" aria-hidden="true" class="avatar-placeholder">
              <circle cx="32" cy="32" r="30" fill="#FBF1EA" stroke="#E7D3C5" stroke-width="1.5" />
              <circle cx="32" cy="26" r="9" fill="#D9C7B8" />
              <path d="M14 54c2-9.5 9-14.5 18-14.5s16 5 18 14.5" fill="#D9C7B8" />
            </svg>
            <span v-if="avatarBusy" class="avatar-busy">处理中…</span>
          </div>
          <div class="avatar-actions">
            <button type="button" class="btn btn-ghost" :disabled="avatarBusy" @click="openCropper">
              {{ avatarUrl ? '换一张' : '上传头像' }}
            </button>
            <button v-if="avatarUrl" type="button" class="btn btn-ghost" :disabled="avatarBusy" @click="removeAvatar">
              移除
            </button>
          </div>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="onFileChange"
          />
          <p class="field-hint">JPG / PNG / WEBP，保存时自动裁剪为方形并压缩</p>
        </div>

        <label class="field">
          <span class="field-label">怎么称呼</span>
          <input
            v-model="name"
            class="field-input"
            type="text"
            maxlength="20"
            placeholder="例如：小厨、阿宝"
            autocomplete="off"
          />
        </label>

        <div class="field">
          <p class="field-label">现在的心情 / 在做什么</p>
          <div class="preset-grid">
            <button
              v-for="preset in PRESETS"
              :key="preset"
              type="button"
              class="preset"
              :class="{ 'is-active': statusPreset === preset }"
              :aria-pressed="statusPreset === preset"
              @click="applyPreset(preset)"
            >
              {{ preset }}
            </button>
          </div>
          <input
            v-model="statusText"
            class="field-input status-input"
            type="text"
            maxlength="20"
            placeholder="或者写一句自己的（最多 20 字）"
            @input="onStatusInput"
          />
          <p class="field-hint">{{ updatedText }}</p>
        </div>

        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      </div>

      <footer class="sheet-foot">
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </footer>
    </div>

    <AvatarCropper v-model:show="cropperOpen" :file="pendingFile" @cropped="uploadCropped" />
  </Popup>
</template>

<style scoped lang="scss">
.profile-panel {
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8PX;
  padding: 14PX 16PX 6PX;

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

.profile-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4PX 16PX 12PX;
}

.avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8PX 0 4PX;
}

.avatar-preview {
  position: relative;
  width: 96PX;
  height: 96PX;
  overflow: hidden;
  background: $surface-sunken;
  border: 1PX solid $line;
  border-radius: 50%;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  &.is-busy img,
  &.is-busy .avatar-placeholder {
    opacity: 0.45;
  }
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
}

.avatar-busy {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12PX;
  color: $ink-secondary;
}

.avatar-actions {
  display: flex;
  gap: 8PX;
  margin-top: 10PX;

  .btn {
    min-height: 44PX;
  }
}

.field {
  display: block;
  margin-top: 14PX;
}

.field-label {
  display: block;
  margin-bottom: 6PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.field-input {
  width: 100%;
  min-height: 44PX;
  padding: 10PX 12PX;
  font-size: 16PX;
  color: $ink;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;

  &::placeholder {
    font-size: 14PX;
    color: $placeholder;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.status-input {
  margin-top: 8PX;
  font-size: 14PX;
}

.field-hint {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8PX;
}

.preset {
  min-height: 44PX;
  font-size: 13PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;
  transition: background-color $motion-fast $ease-standard, border-color $motion-fast $ease-standard;

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }

  &.is-active {
    color: $ink;
    background: $accent-soft;
    border-color: $accent-line;
  }
}

.error-text {
  margin-top: 10PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $danger-text;
}

.sheet-foot {
  padding: 8PX 16PX calc(12PX + env(safe-area-inset-bottom));
  border-top: 1PX solid $line-soft;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  width: 100%;
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;
}

.btn-ghost {
  color: $ink-secondary;
  background: $surface;
}

.sr-only {
  position: absolute;
  width: 1PX;
  height: 1PX;
  padding: 0;
  margin: -1PX;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
