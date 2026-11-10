// 打卡心情预设与「我是谁」身份：保持轻量，避免引入新的状态库
import { ref } from 'vue'

export interface MoodOption {
  key: string
  label: string
}

export const MOODS: MoodOption[] = [
  { key: 'happy', label: '开心' },
  { key: 'calm', label: '平静' },
  { key: 'tired', label: '有点累' },
  { key: 'down', label: '情绪低' },
  { key: 'excited', label: '期待' },
  { key: 'busy', label: '忙碌' },
]

export function moodLabel(key: string): string {
  return MOODS.find((item) => item.key === key)?.label || ''
}

const VIEWER_KEY = 'couple:viewerSlot'

function readViewer(): 1 | 2 {
  if (typeof window === 'undefined') return 1
  return window.localStorage.getItem(VIEWER_KEY) === '2' ? 2 : 1
}

// 点赞 / 回复时使用：默认第 1 位，切换后记住
export const viewerSlot = ref<1 | 2>(readViewer())

export function setViewerSlot(slot: 1 | 2): void {
  viewerSlot.value = slot
  if (typeof window !== 'undefined') window.localStorage.setItem(VIEWER_KEY, String(slot))
}
