<script setup lang="ts">
// 经期面板：状态 / 统计 / 趋势图 / 记录增删改 / 免责说明
import { computed, nextTick, ref } from 'vue'
import { showToast } from 'vant'
import {
  CoupleApiError,
  coupleApi,
  type CyclePayload,
  type CyclePrediction,
  type CycleRecord,
  type CycleStats,
} from '@/api/couple'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const props = defineProps<{
  records: CycleRecord[]
  stats: CycleStats
  prediction: CyclePrediction
  today: string
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const startDate = ref('')
const endDate = ref('')
const note = ref('')
const submitting = ref(false)
const formError = ref('')
const formRef = ref<HTMLElement | null>(null)
const startInput = ref<HTMLInputElement | null>(null)

const confirmVisible = ref(false)
const confirmTarget = ref<CycleRecord | null>(null)
const deleting = ref(false)

const sortedRecords = computed(() =>
  props.records.slice().sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
)

const trend = computed(() => props.stats.trend)
const trendMax = computed(() => Math.max(1, ...trend.value.map((item) => item.length)))
const trendAria = computed(() =>
  trend.value.length
    ? `周期长度趋势：${trend.value.map((item) => `${item.startDate} 为 ${item.length} 天`).join('，')}`
    : '暂无足够的周期数据'
)

const statusClass = computed(() => {
  if (props.prediction.status === 'overdue') return 'status-warn'
  if (props.prediction.status === 'period') return 'status-period'
  return 'status-normal'
})

function errorMessage(error: unknown): string {
  if (error instanceof CoupleApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}

function periodDays(record: CycleRecord): number | null {
  if (!record.endDate) return null
  const start = Date.parse(`${record.startDate}T00:00:00Z`)
  const end = Date.parse(`${record.endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86400000) + 1
}

function shortDate(value: string): string {
  return value.slice(5)
}

function openCreate(): void {
  editingId.value = null
  startDate.value = props.today
  endDate.value = ''
  note.value = ''
  formError.value = ''
  formOpen.value = true
  nextTick(() => startInput.value?.focus())
}

function openEdit(record: CycleRecord): void {
  editingId.value = record.id
  startDate.value = record.startDate
  endDate.value = record.endDate || ''
  note.value = record.note
  formError.value = ''
  formOpen.value = true
  nextTick(() => {
    formRef.value?.scrollIntoView({ block: 'start' })
    startInput.value?.focus()
  })
}

function closeForm(): void {
  formOpen.value = false
  formError.value = ''
}

async function submit(): Promise<void> {
  formError.value = ''
  if (!startDate.value) {
    formError.value = '请选择开始日期'
    return
  }
  if (endDate.value && endDate.value < startDate.value) {
    formError.value = '结束日期不能早于开始日期'
    return
  }
  submitting.value = true
  const payload: CyclePayload = {
    startDate: startDate.value,
    endDate: endDate.value || null,
    note: note.value.trim(),
  }
  try {
    if (editingId.value) {
      await coupleApi.updateCycle(editingId.value, payload)
      showToast('已保存修改')
    } else {
      await coupleApi.createCycle(payload)
      showToast('已记录')
    }
    formOpen.value = false
    emit('changed')
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    submitting.value = false
  }
}

function askDelete(record: CycleRecord): void {
  confirmTarget.value = record
  confirmVisible.value = true
}

async function remove(): Promise<void> {
  const target = confirmTarget.value
  if (!target || deleting.value) return
  deleting.value = true
  try {
    await coupleApi.removeCycle(target.id)
    showToast('已删除')
    emit('changed')
  } catch (error) {
    showToast(errorMessage(error))
  } finally {
    deleting.value = false
    confirmTarget.value = null
  }
}
</script>

<template>
  <div class="cycle">
    <section class="status-card" :class="statusClass" aria-labelledby="couple-cycle-status-title">
      <h2 id="couple-cycle-status-title" class="sr-only">经期状态</h2>
      <p class="status-eyebrow">当前状态</p>
      <p class="status-text">{{ prediction.statusText }}</p>
      <p v-if="prediction.nextStart" class="status-next">预计下次开始：{{ prediction.nextStart }}</p>
      <p class="status-note">预测基于历史记录估算，仅供参考，不构成医疗建议。</p>
    </section>

    <section class="stats" aria-labelledby="couple-cycle-stats-title">
      <h2 id="couple-cycle-stats-title" class="sr-only">周期统计</h2>
      <div class="stat">
        <p class="stat-label">平均周期</p>
        <p class="stat-value">{{ stats.averageCycle !== null ? `${stats.averageCycle} 天` : '—' }}</p>
      </div>
      <div class="stat">
        <p class="stat-label">平均经期</p>
        <p class="stat-value">{{ stats.averagePeriod !== null ? `${stats.averagePeriod} 天` : '—' }}</p>
      </div>
      <div class="stat">
        <p class="stat-label">已记录</p>
        <p class="stat-value">{{ stats.recordCount }} 次</p>
      </div>
    </section>

    <p v-if="!stats.sampleEnough && stats.recordCount > 0" class="sample-note">
      样本不足：当前只有 {{ stats.intervalCount }} 个周期间隔，至少需要 3 次记录（2
      个间隔）才能给出预测。
    </p>

    <section class="card" aria-labelledby="couple-trend-title">
      <div class="card-head">
        <h2 id="couple-trend-title">周期趋势</h2>
        <span class="card-tag">最近 {{ trend.length }} 个周期</span>
      </div>
      <figure v-if="trend.length" class="chart">
        <div class="bars" role="img" :aria-label="trendAria">
          <div v-for="item in trend" :key="item.startDate" class="bar-col">
            <span class="bar-value">{{ item.length }}</span>
            <div class="bar-track">
              <div class="bar" :style="{ height: `${Math.max(12, (item.length / trendMax) * 100)}%` }" />
            </div>
            <span class="bar-label">{{ shortDate(item.startDate) }}</span>
          </div>
        </div>
        <figcaption class="chart-note">
          纵轴为两次开始之间的天数：最短 {{ stats.minCycle ?? '—' }} 天，最长
          {{ stats.maxCycle ?? '—' }} 天。
        </figcaption>
      </figure>
      <p v-else class="empty-line">记录 3 次以上后，这里会显示周期长度趋势。</p>
    </section>

    <div class="panel-head">
      <div>
        <h2>经期记录</h2>
        <p>记录开始与结束日期，用于计算平均周期</p>
      </div>
      <button type="button" class="btn btn-primary" :aria-expanded="formOpen" @click="openCreate">
        记录
      </button>
    </div>

    <form v-if="formOpen" ref="formRef" class="form-card" @submit.prevent="submit">
      <h3>{{ editingId ? '编辑记录' : '新增记录' }}</h3>
      <div class="field-row">
        <label class="field">
          <span class="field-label">开始日期</span>
          <input ref="startInput" v-model="startDate" class="input" type="date" required />
        </label>
        <label class="field">
          <span class="field-label">结束日期（可选）</span>
          <input v-model="endDate" class="input" type="date" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">备注（可选）</span>
        <input v-model="note" class="input" type="text" maxlength="120" placeholder="例如：腰有点酸" />
      </label>
      <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" @click="closeForm">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>

    <ul v-if="sortedRecords.length" class="list">
      <li v-for="record in sortedRecords" :key="record.id" class="item">
        <div class="item-main">
          <p class="item-range">
            {{ record.startDate }}
            <span v-if="record.endDate"> ~ {{ shortDate(record.endDate) }}</span>
            <span v-if="periodDays(record)" class="tag">共 {{ periodDays(record) }} 天</span>
          </p>
          <p v-if="record.note" class="item-note">{{ record.note }}</p>
        </div>
        <div class="item-actions">
          <button type="button" class="link-btn" @click="openEdit(record)">编辑</button>
          <button type="button" class="link-btn danger" @click="askDelete(record)">删除</button>
        </div>
      </li>
    </ul>

    <p v-else-if="!formOpen" class="empty-line">还没有记录，点「记录」添加第一次。</p>

    <section class="tips" aria-labelledby="couple-tips-title">
      <h2 id="couple-tips-title">日常照顾</h2>
      <ul>
        <li>按平常的节奏休息，困了就早点睡。</li>
        <li>想喝热的就喝热的，不用强迫自己。</li>
        <li>如果明显不适或周期长期紊乱，请咨询专业医生。</li>
      </ul>
      <p class="tips-note">以上内容仅为日常提醒，不构成医疗建议。</p>
    </section>

    <ConfirmDialog
      v-model:show="confirmVisible"
      title="删除记录？"
      :message="confirmTarget ? `确定删除 ${confirmTarget.startDate} 开始的记录吗？` : ''"
      confirm-text="删除"
      danger
      @confirm="remove"
    />
  </div>
</template>

<style scoped lang="scss">
.cycle {
  display: flex;
  flex-direction: column;
  gap: 12PX;
}

.status-card {
  padding: 18PX 16PX;
  border-radius: 20PX;
  border: 1PX solid $line;
  background: $surface;

  &.status-period {
    background: $danger-tint;
    border-color: #f2c9cc;
  }

  &.status-warn {
    background: $warning-tint;
    border-color: #f0d9a8;
  }
}

.status-eyebrow {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.status-text {
  margin-top: 4PX;
  font-size: 18PX;
  font-weight: 600;
  line-height: 1.35;
  color: $ink;
  overflow-wrap: anywhere;
}

.status-next {
  margin-top: 4PX;
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.status-note {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.stats {
  display: flex;
  gap: 8PX;
}

.stat {
  flex: 1;
  min-width: 0;
  padding: 12PX 10PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.stat-label {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.stat-value {
  margin-top: 2PX;
  font-size: 16PX;
  font-weight: 600;
  line-height: 1.35;
  color: $ink;
  overflow-wrap: anywhere;
}

.sample-note {
  padding: 10PX 12PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $warning-text;
  background: $warning-tint;
  border-radius: 12PX;
}

.card {
  padding: 18PX 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8PX;
  margin-bottom: 10PX;

  h2 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }
}

.card-tag {
  flex: none;
  padding: 1PX 8PX;
  font-size: 12PX;
  line-height: 18PX;
  color: $ink-muted;
  background: $line-soft;
  border-radius: 8PX;
}

.chart {
  margin: 0;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 8PX;
  height: 150PX;
  padding-top: 18PX;
}

.bar-col {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.bar-value {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-secondary;
}

.bar-track {
  width: 100%;
  max-width: 28PX;
  flex: 1;
  display: flex;
  align-items: flex-end;
  margin: 2PX 0 4PX;
}

.bar {
  width: 100%;
  border-radius: 8PX 8PX 0 0;
  background: $brand-action;
  transition: height $motion-base $ease-standard;
}

.bar-label {
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
  white-space: nowrap;
}

.chart-note {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.empty-line {
  font-size: 13PX;
  line-height: 1.5;
  color: $ink-muted;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12PX;
  margin-top: 4PX;

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

.field-row {
  display: flex;
  gap: 8PX;

  .field {
    flex: 1;
    min-width: 0;
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
  flex: none;
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;
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
  padding: 12PX 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
}

.item-range {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6PX;
  font-size: 14PX;
  font-weight: 500;
  line-height: 1.5;
  color: $ink;
}

.tag {
  padding: 1PX 6PX;
  font-size: 12PX;
  font-weight: 400;
  line-height: 18PX;
  color: $ink-muted;
  background: $line-soft;
  border-radius: 8PX;
}

.item-note {
  margin-top: 2PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
  overflow-wrap: anywhere;
}

.item-actions {
  display: flex;
  gap: 4PX;
  margin-top: 6PX;
  padding-top: 4PX;
  border-top: 1PX solid $line-soft;
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

.tips {
  padding: 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;

  h2 {
    font-size: 16PX;
    font-weight: 600;
    line-height: 1.25;
    color: $ink;
  }

  ul {
    margin-top: 8PX;
    display: flex;
    flex-direction: column;
    gap: 4PX;
  }

  li {
    position: relative;
    padding-left: 14PX;
    font-size: 13PX;
    line-height: 1.5;
    color: $ink-secondary;

    &::before {
      content: '';
      position: absolute;
      left: 2PX;
      top: 8PX;
      width: 4PX;
      height: 4PX;
      border-radius: 50%;
      background: $ink-muted;
    }
  }
}

.tips-note {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
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
