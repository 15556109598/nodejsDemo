<script setup lang="ts">
// 纪念日面板：列表 + 新增/编辑/置顶/删除
import { nextTick, ref } from 'vue'
import { showToast } from 'vant'
import {
  CoupleApiError,
  coupleApi,
  type AnniversaryPayload,
  type CoupleAnniversary,
} from '@/api/couple'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const props = defineProps<{
  items: CoupleAnniversary[]
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const title = ref('')
const date = ref('')
const yearly = ref(false)
const icon = ref('')
const pinned = ref(false)
const submitting = ref(false)
const formError = ref('')
const formRef = ref<HTMLElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)

const confirmVisible = ref(false)
const confirmTarget = ref<CoupleAnniversary | null>(null)
const deleting = ref(false)

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function errorMessage(error: unknown): string {
  if (error instanceof CoupleApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}

function resetForm(): void {
  editingId.value = null
  title.value = ''
  date.value = todayStr()
  yearly.value = false
  icon.value = ''
  pinned.value = false
  formError.value = ''
}

function openCreate(): void {
  resetForm()
  formOpen.value = true
  nextTick(() => titleInput.value?.focus())
}

function openEdit(item: CoupleAnniversary): void {
  editingId.value = item.id
  title.value = item.title
  date.value = item.date
  yearly.value = item.yearly
  icon.value = item.icon
  pinned.value = item.pinned
  formError.value = ''
  formOpen.value = true
  nextTick(() => {
    formRef.value?.scrollIntoView({ block: 'start' })
    titleInput.value?.focus()
  })
}

function closeForm(): void {
  formOpen.value = false
  formError.value = ''
}

async function submit(): Promise<void> {
  formError.value = ''
  if (!title.value.trim()) {
    formError.value = '请填写纪念日名称'
    return
  }
  if (!date.value) {
    formError.value = '请选择日期'
    return
  }
  submitting.value = true
  const payload: AnniversaryPayload = {
    title: title.value.trim(),
    date: date.value,
    yearly: yearly.value,
    icon: icon.value.trim(),
    // 第一版不支持在模块内上传照片，保留已有地址
    photoUrl: editingId.value ? props.items.find((i) => i.id === editingId.value)?.photoUrl || '' : '',
    pinned: pinned.value,
  }
  try {
    if (editingId.value) {
      await coupleApi.updateAnniversary(editingId.value, payload)
      showToast('已保存修改')
    } else {
      await coupleApi.createAnniversary(payload)
      showToast('已添加纪念日')
    }
    formOpen.value = false
    emit('changed')
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    submitting.value = false
  }
}

async function togglePin(item: CoupleAnniversary): Promise<void> {
  try {
    await coupleApi.updateAnniversary(item.id, {
      title: item.title,
      date: item.date,
      yearly: item.yearly,
      icon: item.icon,
      photoUrl: item.photoUrl,
      pinned: !item.pinned,
    })
    showToast(item.pinned ? '已取消置顶' : '已置顶')
    emit('changed')
  } catch (error) {
    showToast(errorMessage(error))
  }
}

function askDelete(item: CoupleAnniversary): void {
  confirmTarget.value = item
  confirmVisible.value = true
}

async function remove(): Promise<void> {
  const target = confirmTarget.value
  if (!target || deleting.value) return
  deleting.value = true
  try {
    await coupleApi.removeAnniversary(target.id)
    showToast('已删除')
    emit('changed')
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    deleting.value = false
    confirmTarget.value = null
  }
}

function dateLabel(value: string): string {
  const [y, m, d] = value.split('-')
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
}
</script>

<template>
  <div class="anniversary">
    <div class="panel-head">
      <div>
        <h2>纪念日</h2>
        <p>一次性或每年重复，最多可置顶一个</p>
      </div>
      <button type="button" class="btn btn-primary" :aria-expanded="formOpen" @click="openCreate">
        添加
      </button>
    </div>

    <form v-if="formOpen" ref="formRef" class="form-card" @submit.prevent="submit">
      <h3>{{ editingId ? '编辑纪念日' : '新增纪念日' }}</h3>

      <label class="field">
        <span class="field-label">名称</span>
        <input
          ref="titleInput"
          v-model="title"
          class="input"
          type="text"
          maxlength="40"
          placeholder="例如：在一起的日子"
          required
          :aria-invalid="Boolean(formError && !title.trim())"
        />
      </label>

      <label class="field">
        <span class="field-label">日期</span>
        <input v-model="date" class="input" type="date" required />
      </label>

      <label class="field">
        <span class="field-label">图标（可选，最多 4 个字符）</span>
        <input v-model="icon" class="input" type="text" maxlength="4" placeholder="例如：💗" />
      </label>

      <label class="check">
        <input v-model="yearly" type="checkbox" />
        <span>每年重复（只过一次的纪念日不要勾选）</span>
      </label>

      <label class="check">
        <input v-model="pinned" type="checkbox" />
        <span>置顶为首页头图</span>
      </label>

      <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" @click="closeForm">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>

    <ul v-if="items.length" class="list">
      <li v-for="item in items" :key="item.id" class="item">
        <div class="item-main">
          <div class="item-title-row">
            <span v-if="item.icon" class="item-icon" aria-hidden="true">{{ item.icon }}</span>
            <h3 class="item-title">{{ item.title }}</h3>
            <span v-if="item.pinned" class="tag tag-brand">置顶</span>
            <span class="tag">{{ item.yearly ? '每年' : '一次性' }}</span>
          </div>
          <p class="item-date">
            {{ dateLabel(item.date) }}
            <template v-if="item.yearly"> · 下一个 {{ item.nextDate }}</template>
          </p>
          <p class="item-metrics">
            <span>{{ item.daysSince >= 0 ? `已经 ${item.daysSince} 天` : `还有 ${-item.daysSince} 天` }}</span>
            <span v-if="item.yearly">距下一个 {{ item.daysUntilNext }} 天</span>
          </p>
        </div>
        <div class="item-actions">
          <button type="button" class="link-btn" @click="togglePin(item)">
            {{ item.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button type="button" class="link-btn" @click="openEdit(item)">编辑</button>
          <button type="button" class="link-btn danger" @click="askDelete(item)">删除</button>
        </div>
      </li>
    </ul>

    <div v-else-if="!formOpen" class="empty-card">
      <p class="empty-title">还没有纪念日</p>
      <p class="empty-desc">添加一个重要的日子，首页会显示已经一起走过的天数。</p>
      <button type="button" class="btn btn-primary" @click="openCreate">添加第一个纪念日</button>
    </div>

    <ConfirmDialog
      v-model:show="confirmVisible"
      title="删除纪念日？"
      :message="confirmTarget ? `确定删除「${confirmTarget.title}」吗？` : ''"
      confirm-text="删除"
      danger
      @confirm="remove"
    />
  </div>
</template>

<style scoped lang="scss">
.anniversary {
  display: flex;
  flex-direction: column;
  gap: 12PX;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12PX;

  h2 {
    font-size: 18PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }

  p {
    margin-top: 4PX;
    font-size: 12PX;
    line-height: 1.5;
    color: $ink-muted;
  }
}

.form-card {
  padding: 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;

  h3 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
    margin-bottom: 12PX;
  }
}

.field {
  display: block;
  margin-bottom: 12PX;
}

.field-label {
  display: block;
  margin-bottom: 6PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.input {
  width: 100%;
  min-height: 44PX;
  padding: 10PX 12PX;
  font-size: 14PX;
  color: $ink;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;

  &::placeholder {
    color: $placeholder;
  }

  &[aria-invalid='true'] {
    border-color: $danger-text;
  }
}

.check {
  display: flex;
  align-items: center;
  gap: 8PX;
  min-height: 44PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;

  input {
    width: 20PX;
    height: 20PX;
  }
}

.error-text {
  font-size: 12PX;
  line-height: 1.5;
  color: $danger-text;
}

.form-actions {
  display: flex;
  gap: 8PX;
  margin-top: 8PX;
}

.btn {
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;
  flex: none;
}

.btn-ghost {
  flex: 1;
  color: $ink-secondary;
  background: $surface;
}

.form-card .btn-primary {
  flex: 1;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10PX;
}

.item {
  padding: 14PX 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 6PX;
  min-width: 0;
}

.item-icon {
  font-size: 16PX;
}

.item-title {
  min-width: 0;
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.25;
  color: $ink;
  overflow-wrap: anywhere;
}

.tag {
  flex: none;
  padding: 1PX 6PX;
  font-size: 12PX;
  line-height: 18PX;
  color: $ink-muted;
  background: $line-soft;
  border-radius: 8PX;

  &.tag-brand {
    color: $brand-action;
    background: $brand-tint;
  }
}

.item-date {
  margin-top: 4PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.item-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10PX;
  margin-top: 6PX;

  span {
    font-size: 13PX;
    line-height: 1.5;
    color: $ink-secondary;
  }

  span:first-child {
    font-weight: 500;
    color: $brand-action;
  }
}

.item-actions {
  display: flex;
  gap: 4PX;
  margin-top: 10PX;
  border-top: 1PX solid $line-soft;
  padding-top: 6PX;
}

.link-btn {
  min-height: 44PX;
  min-width: 44PX;
  padding: 0 8PX;
  font-size: 13PX;
  color: $brand-action;
  background: transparent;
  border: none;
  cursor: pointer;

  &.danger {
    color: $danger-text;
  }
}

.empty-card {
  padding: 24PX 20PX;
  text-align: center;
  background: $surface;
  border: 1PX dashed $line;
  border-radius: 20PX;

  .empty-title {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }

  .empty-desc {
    margin: 6PX 0 14PX;
    font-size: 13PX;
    line-height: 1.5;
    color: $ink-muted;
  }
}
</style>
