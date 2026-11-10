<script setup lang="ts">
// 打卡弹层：心情预设 + 补一句 + 简短描述；已打卡时作为编辑入口
import { computed, ref, watch } from 'vue'
import { Popup, showToast } from 'vant'
import { CoupleApiError, coupleApi, type CheckinSlotState, type CheckinSummary } from '@/api/couple'
import { MOODS } from '../mood'

const props = defineProps<{
  show: boolean
  slot: 1 | 2
  name: string
  state: CheckinSlotState | null
}>()

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
  (event: 'saved', summary: CheckinSummary): void
}>()

const mood = ref('')
const moodText = ref('')
const note = ref('')
const busy = ref(false)
const error = ref('')

const done = computed(() => Boolean(props.state?.done))

watch(
  () => props.show,
  (value) => {
    if (!value) return
    mood.value = props.state?.mood || ''
    moodText.value = props.state?.moodText || ''
    note.value = props.state?.note || ''
    error.value = ''
  }
)

function errorMessage(err: unknown): string {
  if (err instanceof CoupleApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return '操作失败，请稍后重试'
}

function toggleMood(key: string): void {
  mood.value = mood.value === key ? '' : key
}

async function submit(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const summary = await coupleApi.checkin(props.slot, {
      mood: mood.value,
      moodText: moodText.value.trim(),
      note: note.value.trim(),
    })
    emit('saved', summary)
    emit('update:show', false)
    showToast(done.value ? '已更新今天的打卡' : `${props.name} 打卡成功`)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function undo(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const summary = await coupleApi.undoCheckin(props.slot)
    emit('saved', summary)
    emit('update:show', false)
    showToast('已撤销今天的打卡')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Popup
    :show="show"
    position="bottom"
    round
    teleport="body"
    class="couple-sheet checkin-sheet"
    safe-area-inset-bottom
    :style="{ maxHeight: '82vh' }"
    close-on-click-overlay
    @update:show="emit('update:show', $event)"
  >
    <div class="sheet-head">
      <div>
        <h2 class="sheet-title">{{ name }} 的今日打卡</h2>
        <p class="sheet-sub">{{ done ? '已经打过卡，可以补充或修改今天的状态' : '写一点今天的样子，只有你们能看到' }}</p>
      </div>
    </div>

    <div class="sheet-body">
      <p class="field-label">今天的状态</p>
      <div class="mood-grid" role="group" aria-label="选择今天的心情">
        <button
          v-for="item in MOODS"
          :key="item.key"
          type="button"
          class="mood-chip"
          :class="{ 'is-active': mood === item.key }"
          :aria-pressed="mood === item.key"
          @click="toggleMood(item.key)"
        >
          {{ item.label }}
        </button>
      </div>

      <label class="field-label" for="checkin-mood-text">再补一句（可选）</label>
      <input
        id="checkin-mood-text"
        v-model="moodText"
        class="input"
        type="text"
        maxlength="12"
        placeholder="例如：被今天的晚霞治愈"
      />

      <label class="field-label" for="checkin-note">今天想说的（可选）</label>
      <textarea
        id="checkin-note"
        v-model="note"
        class="input textarea"
        rows="3"
        maxlength="120"
        placeholder="今天发生了什么、想对 TA 说的话…"
      />
      <p class="field-hint">最多 120 字，可以换行。</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    </div>

    <div class="sheet-foot">
      <button v-if="done" type="button" class="btn btn-ghost danger" :disabled="busy" @click="undo">
        撤销打卡
      </button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="submit">
        {{ busy ? '保存中…' : done ? '保存修改' : '打卡' }}
      </button>
    </div>
  </Popup>
</template>

<style scoped lang="scss">
.sheet-head {
  padding: 20PX 20PX 0;
}

.sheet-title {
  font-size: 18PX;
  font-weight: 600;
  line-height: 1.3;
  color: $ink;
}

.sheet-sub {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.sheet-body {
  padding: 4PX 20PX 0;
}

.field-label {
  display: block;
  margin: 16PX 0 8PX;
  font-size: 13PX;
  font-weight: 500;
  color: $ink-secondary;
}

.mood-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8PX;
}

.mood-chip {
  min-height: 44PX;
  font-size: 14PX;
  color: $ink-secondary;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 12PX;
  cursor: pointer;
  transition: background-color $motion-fast $ease-standard, border-color $motion-fast $ease-standard;

  &:hover {
    border-color: $line-strong;
  }

  &.is-active {
    color: $ink;
    font-weight: 600;
    background: $accent-soft;
    border-color: $accent-line;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.input {
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

.textarea {
  min-height: 92PX;
  line-height: 1.5;
  resize: vertical;
}

.field-hint {
  margin-top: 6PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.error-text {
  margin-top: 8PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $danger-text;
}

.sheet-foot {
  display: flex;
  gap: 10PX;
  padding: 16PX 20PX calc(20PX + env(safe-area-inset-bottom));
}

.btn {
  flex: 1;
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

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2PX solid $brand-action;
    outline-offset: 2PX;
  }
}

.btn-primary {
  flex: 1.4;
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;
}

.btn-ghost {
  flex: 1;
  color: $ink-secondary;
  background: $surface;

  &.danger {
    color: $danger-text;
    border-color: $danger-tint;
    background: $danger-tint;
  }
}
</style>
