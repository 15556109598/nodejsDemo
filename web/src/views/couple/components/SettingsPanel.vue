<script setup lang="ts">
// 设置面板：城市/坐标/提醒阈值 + 锁定
import { onMounted, ref, watch } from 'vue'
import { showToast } from 'vant'
import { CoupleApiError, coupleApi, type CoupleDevice, type CoupleSettings } from '@/api/couple'

const props = defineProps<{
  settings: CoupleSettings
  passcodeSet: boolean
}>()

const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'lock'): void
  (e: 'close'): void
}>()

const city = ref(props.settings.city)
const latitude = ref(String(props.settings.latitude))
const longitude = ref(String(props.settings.longitude))
const nearAnniversaryDays = ref(String(props.settings.nearAnniversaryDays))
const cycleAheadDays = ref(String(props.settings.cycleAheadDays))
const cycleDelayDays = ref(String(props.settings.cycleDelayDays))
const weatherDeltaC = ref(String(props.settings.weatherDeltaC))

const saving = ref(false)
const errorMessageText = ref('')

// ---------- 手机桌面入口（设备链接） ----------
const deviceLabel = ref('')
const deviceLink = ref('')
const devices = ref<CoupleDevice[]>([])
const deviceBusy = ref(false)
const deviceMessage = ref('')

async function loadDevices(): Promise<void> {
  if (!props.passcodeSet) return
  try {
    devices.value = await coupleApi.listDevices()
  } catch {
    // 设备列表加载失败不阻断设置面板
  }
}

async function createDeviceLink(): Promise<void> {
  deviceMessage.value = ''
  deviceBusy.value = true
  try {
    const result = await coupleApi.createDeviceLink(deviceLabel.value.trim())
    deviceLink.value = result.url
    deviceLabel.value = ''
    await loadDevices()
    showToast('设备链接已生成')
  } catch (error) {
    deviceMessage.value = errorMessage(error)
  } finally {
    deviceBusy.value = false
  }
}

function selectDeviceLink(event: FocusEvent): void {
  const target = event.target as HTMLInputElement | null
  target?.select()
}

async function copyDeviceLink(): Promise<void> {
  if (!deviceLink.value) return
  try {
    await navigator.clipboard.writeText(deviceLink.value)
    showToast('链接已复制')
  } catch {
    showToast('请长按输入框手动复制')
  }
}

async function revokeDevice(id: string): Promise<void> {
  try {
    await coupleApi.revokeDevice(id)
    await loadDevices()
    showToast('设备已吊销')
  } catch (error) {
    deviceMessage.value = errorMessage(error)
  }
}

onMounted(loadDevices)

watch(
  () => props.settings,
  (value) => {
    city.value = value.city
    latitude.value = String(value.latitude)
    longitude.value = String(value.longitude)
    nearAnniversaryDays.value = String(value.nearAnniversaryDays)
    cycleAheadDays.value = String(value.cycleAheadDays)
    cycleDelayDays.value = String(value.cycleDelayDays)
    weatherDeltaC.value = String(value.weatherDeltaC)
  },
  { deep: true }
)

function errorMessage(error: unknown): string {
  if (error instanceof CoupleApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '保存失败，请稍后重试'
}

function inRange(value: string, min: number, max: number): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max
}

async function save(): Promise<void> {
  errorMessageText.value = ''
  if (!city.value.trim()) {
    errorMessageText.value = '请填写城市名称'
    return
  }
  if (!inRange(latitude.value, -90, 90)) {
    errorMessageText.value = '纬度需在 -90 ~ 90 之间'
    return
  }
  if (!inRange(longitude.value, -180, 180)) {
    errorMessageText.value = '经度需在 -180 ~ 180 之间'
    return
  }
  if (!inRange(nearAnniversaryDays.value, 1, 30)) {
    errorMessageText.value = '纪念日提醒阈值需在 1 ~ 30 天之间'
    return
  }
  if (!inRange(cycleAheadDays.value, 0, 14)) {
    errorMessageText.value = '例假提前提醒需在 0 ~ 14 天之间'
    return
  }
  if (!inRange(cycleDelayDays.value, 1, 15)) {
    errorMessageText.value = '推迟提醒阈值需在 1 ~ 15 天之间'
    return
  }
  if (!inRange(weatherDeltaC.value, 2, 15)) {
    errorMessageText.value = '降温提醒阈值需在 2 ~ 15℃ 之间'
    return
  }

  saving.value = true
  try {
    await coupleApi.saveSettings({
      city: city.value.trim(),
      latitude: Number(latitude.value),
      longitude: Number(longitude.value),
      nearAnniversaryDays: Number(nearAnniversaryDays.value),
      cycleAheadDays: Number(cycleAheadDays.value),
      cycleDelayDays: Number(cycleDelayDays.value),
      weatherDeltaC: Number(weatherDeltaC.value),
    })
    showToast('设置已保存')
    emit('saved')
  } catch (error) {
    errorMessageText.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="settings" aria-labelledby="couple-settings-title">
    <div class="settings-head">
      <h2 id="couple-settings-title">设置</h2>
      <button type="button" class="link-btn" @click="emit('close')">收起</button>
    </div>

    <form @submit.prevent="save">
      <label class="field">
        <span class="field-label">城市名称</span>
        <input v-model="city" class="input" type="text" maxlength="20" placeholder="例如：南京 · 雨花台" />
      </label>

      <div class="field-row">
        <label class="field">
          <span class="field-label">纬度</span>
          <input v-model="latitude" class="input" type="number" step="0.0001" inputmode="decimal" />
        </label>
        <label class="field">
          <span class="field-label">经度</span>
          <input v-model="longitude" class="input" type="number" step="0.0001" inputmode="decimal" />
        </label>
      </div>
      <p class="hint">默认南京 · 雨花台（31.9957, 118.7635），可按自己所在位置修改。</p>

      <div class="field-row">
        <label class="field">
          <span class="field-label">纪念日提前提醒（天）</span>
          <input v-model="nearAnniversaryDays" class="input" type="number" min="1" max="30" inputmode="numeric" />
        </label>
        <label class="field">
          <span class="field-label">例假提前提醒（天）</span>
          <input v-model="cycleAheadDays" class="input" type="number" min="0" max="14" inputmode="numeric" />
        </label>
      </div>

      <div class="field-row">
        <label class="field">
          <span class="field-label">例假推迟提醒（天）</span>
          <input v-model="cycleDelayDays" class="input" type="number" min="1" max="15" inputmode="numeric" />
        </label>
        <label class="field">
          <span class="field-label">降温提醒阈值（℃）</span>
          <input v-model="weatherDeltaC" class="input" type="number" min="2" max="15" inputmode="numeric" />
        </label>
      </div>

      <p v-if="errorMessageText" class="error-text" role="alert">{{ errorMessageText }}</p>

      <button type="submit" class="btn btn-primary btn-block" :disabled="saving">
        {{ saving ? '保存中…' : '保存设置' }}
      </button>
    </form>

    <div v-if="passcodeSet" class="device">
      <h3>手机桌面入口</h3>
      <p class="hint">
        手机把网页「添加到主屏幕」后，浏览器可能不保存登录状态。生成一条带设备凭证的链接，用手机打开后再添加到主屏幕即可直接进入。
      </p>
      <label class="field">
        <span class="field-label">设备名称</span>
        <input v-model="deviceLabel" class="input" type="text" maxlength="30" placeholder="例如：我的 iPhone" />
      </label>
      <button type="button" class="btn btn-primary btn-block" :disabled="deviceBusy" @click="createDeviceLink">
        {{ deviceBusy ? '生成中…' : '生成设备链接' }}
      </button>

      <div v-if="deviceLink" class="device-link">
        <label class="field-label" for="couple-device-link">设备链接（长按或复制）</label>
        <input
          id="couple-device-link"
          class="input"
          :value="deviceLink"
          readonly
          @focus="selectDeviceLink"
        />
        <button type="button" class="btn btn-ghost btn-block" @click="copyDeviceLink">复制链接</button>
      </div>

      <p v-if="deviceMessage" class="error-text" role="alert">{{ deviceMessage }}</p>

      <ul v-if="devices.length" class="device-list">
        <li v-for="item in devices" :key="item.id">
          <div>
            <strong>{{ item.label }}</strong>
            <span>{{ item.createdAt.slice(0, 10) }} 生成</span>
          </div>
          <button type="button" class="link-btn" @click="revokeDevice(item.id)">吊销</button>
        </li>
      </ul>
      <p v-else class="hint">还没有设备链接。</p>
      <p class="hint">安全提示：链接等同于钥匙，请勿外发；手机丢失时在这里吊销即可。</p>
    </div>

    <div class="security">
      <h3>隐私</h3>
      <p v-if="passcodeSet">口令已启用，所有接口都需要有效 cookie 或本地凭证才能访问。</p>
      <p v-else>未设置 <code>COUPLE_PASSCODE</code>，当前内容公开可见。</p>
      <button v-if="passcodeSet" type="button" class="btn btn-ghost btn-block" @click="emit('lock')">
        锁定并清除登录凭证
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings {
  margin-bottom: 12PX;
  padding: 18PX 16PX;
  background: $surface;
  border: 1PX solid $line;
  border-radius: 20PX;
}

.settings-head {
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

.field {
  display: block;
  margin-bottom: 12PX;
}

.field-row {
  display: flex;
  gap: 8PX;

  .field {
    flex: 1;
    min-width: 0;
  }
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

.hint {
  margin: -4PX 0 12PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $ink-muted;
}

.error-text {
  margin-bottom: 10PX;
  font-size: 12PX;
  line-height: 1.5;
  color: $danger-text;
}

.btn {
  min-height: 44PX;
  padding: 0 16PX;
  font-size: 14PX;
  font-weight: 500;
  border-radius: 12PX;
  border: 1PX solid $line;
  cursor: pointer;
}

.btn-block {
  width: 100%;
}

.btn-primary {
  color: #fff;
  background: $brand-action;
  border-color: $brand-action;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-ghost {
  color: $ink-secondary;
  background: $surface;
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
}

.device {
  margin-top: 16PX;
  padding-top: 12PX;
  border-top: 1PX solid $line-soft;

  h3 {
    margin-bottom: 4PX;
    font-size: 14PX;
    font-weight: 600;
    line-height: 1.5;
    color: $ink;
  }

  .device-link {
    margin: 10PX 0 6PX;
  }
}

.device-list {
  margin: 4PX 0 8PX;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8PX;
    padding: 6PX 0;
    border-bottom: 1PX solid $line-soft;

    div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    strong {
      font-size: 13PX;
      font-weight: 600;
      color: $ink;
    }

    span {
      font-size: 12PX;
      color: $ink-muted;
    }
  }
}

.security {
  margin-top: 16PX;
  padding-top: 12PX;
  border-top: 1PX solid $line-soft;

  h3 {
    font-size: 14PX;
    font-weight: 600;
    line-height: 1.5;
    color: $ink;
  }

  p {
    margin: 4PX 0 10PX;
    font-size: 12PX;
    line-height: 1.5;
    color: $ink-muted;
  }

  code {
    font-size: 12PX;
    color: $ink;
  }
}
</style>
