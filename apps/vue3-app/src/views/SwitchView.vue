<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveSettings, updateBasicSettings, type BasicSettings } from '@/lib/save-api'
import { useAuthStore } from '@/stores/auth'

type ToggleKey = 'master_enabled' | 'market_enabled' | 'followed_enabled' | 'optional_enabled'

const router = useRouter()
const authStore = useAuthStore()
const deviceId = getDeviceId()
const needsMobileBinding = computed(() => authStore.isLoggedIn && authStore.user?.mobile_bound !== true)

const settings = ref<BasicSettings>({
  master_enabled: false,
  market_enabled: false,
  followed_enabled: false,
  optional_enabled: false,
  alert_threshold: 3,
})
const thresholds = [2, 3, 5, 8]
const loading = ref(false)
const error = ref('')

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetchSaveSettings(deviceId)
    settings.value = response.basic_settings
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载设置失败'
  } finally {
    loading.value = false
  }
}

async function persistSettings() {
  if (needsMobileBinding.value) return
  try {
    const response = await updateBasicSettings(deviceId, settings.value)
    settings.value = response.basic_settings
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '保存设置失败'
  }
}

function goToRemindSettings() {
  router.push('/save/remind-settings')
}

function goToBindMobile() {
  router.push('/login')
}

async function toggle(key: ToggleKey) {
  if (needsMobileBinding.value) return
  settings.value = {
    ...settings.value,
    [key]: !settings.value[key],
  }
  await persistSettings()
}

async function selectThreshold(value: number) {
  if (needsMobileBinding.value) return
  settings.value = {
    ...settings.value,
    alert_threshold: value,
  }
  await persistSettings()
}

onMounted(() => {
  void loadSettings()
})
</script>

<template>
  <div class="page">
    <div class="content">
      <div v-if="needsMobileBinding" class="binding-card">
        <strong>绑定手机号后才能开启提醒服务</strong>
        <p>提醒总开关、阈值设置和高级提醒配置都依赖手机号身份。请先绑定手机号，再继续设置。</p>
        <button class="binding-btn" @click="goToBindMobile">去绑定手机号</button>
      </div>

      <div v-if="error" class="status-card error-card">{{ error }}</div>
      <div v-else-if="loading" class="status-card">正在加载提醒设置...</div>

      <div class="card">
        <div class="switch-row master" :class="{ disabled: needsMobileBinding }" @click="toggle('master_enabled')">
          <div class="switch-info">
            <span class="switch-label">提醒总开关</span>
            <span :class="['switch-status', settings.master_enabled ? 'on' : 'off']">
              {{ settings.master_enabled ? '已开启提醒，满足阈值时会记录并推送提醒' : '当前已关闭提醒服务' }}
            </span>
          </div>
          <div class="switch-control">
            <input type="checkbox" :checked="settings.master_enabled" :disabled="needsMobileBinding" @click.stop="toggle('master_enabled')" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="switch-row" :class="{ disabled: needsMobileBinding }" @click="toggle('market_enabled')">
          <div class="switch-info">
            <span class="switch-label">大盘异动提醒</span>
            <span class="switch-desc">是否关注市场整体波动带来的机会变化。</span>
          </div>
          <div class="switch-control">
            <input type="checkbox" :checked="settings.market_enabled" :disabled="needsMobileBinding" @click.stop="toggle('market_enabled')" />
          </div>
        </div>

        <div class="divider"></div>

        <div class="switch-row" :class="{ disabled: needsMobileBinding }" @click="toggle('followed_enabled')">
          <div class="switch-info">
            <span class="switch-label">关注基金提醒</span>
            <span class="switch-desc">对你已关注的基金开启提醒偏好。</span>
          </div>
          <div class="switch-control">
            <input type="checkbox" :checked="settings.followed_enabled" :disabled="needsMobileBinding" @click.stop="toggle('followed_enabled')" />
          </div>
        </div>

        <div class="divider"></div>

        <div class="switch-row" :class="{ disabled: needsMobileBinding }" @click="toggle('optional_enabled')">
          <div class="switch-info">
            <span class="switch-label">自选提醒</span>
            <span class="switch-desc">自选基金涨跌变化时的提醒偏好设置。</span>
          </div>
          <div class="switch-control">
            <input type="checkbox" :checked="settings.optional_enabled" :disabled="needsMobileBinding" @click.stop="toggle('optional_enabled')" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="threshold-header">
          <span class="threshold-title">涨跌幅阈值</span>
          <span class="threshold-desc">超过该阈值时，前端会按你的偏好展示提醒。</span>
        </div>
        <div class="threshold-options">
          <div
            v-for="threshold in thresholds"
            :key="threshold"
            :class="['threshold-btn', { active: settings.alert_threshold === threshold, disabled: needsMobileBinding }]"
            @click="selectThreshold(threshold)"
          >
            {{ threshold }}%
          </div>
        </div>
      </div>

      <div class="card more-card" @click="goToRemindSettings">
        <div class="more-info">
          <span class="more-title">更多提醒设置</span>
          <span class="more-desc">基金套利、可转债等高级提醒配置。</span>
        </div>
        <span class="more-arrow">›</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: #f5f7fa; }
.content { padding: 16px; }
.binding-card { background: #fff7ed; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.binding-card strong { display: block; color: #9a3412; font-size: 15px; }
.binding-card p { margin-top: 8px; color: #9a3412; font-size: 12px; line-height: 1.7; }
.binding-btn { margin-top: 12px; height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: #ea580c; color: #fff; font-size: 13px; font-weight: 700; }
.status-card { background: white; border-radius: 12px; padding: 20px 16px; margin-bottom: 12px; color: #666; text-align: center; }
.error-card { color: #d32f2f; background: #ffebee; }
.card { background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.switch-row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.switch-row.disabled { opacity: 0.48; }
.switch-info { flex: 1; }
.switch-label { font-size: 16px; font-weight: 600; color: #333; display: block; }
.switch-desc { font-size: 12px; color: #999; display: block; margin-top: 4px; }
.switch-status { font-size: 12px; display: block; margin-top: 4px; }
.switch-status.on { color: #4caf50; }
.switch-status.off { color: #999; }
.switch-control input { width: 48px; height: 28px; appearance: none; background: #ccc; border-radius: 14px; position: relative; cursor: pointer; }
.switch-control input::before { content: ''; position: absolute; width: 24px; height: 24px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: 0.3s; }
.switch-control input:checked { background: #667eea; }
.switch-control input:checked::before { left: 22px; }
.divider { height: 1px; background: #f0f0f0; margin: 16px 0; }
.threshold-header { margin-bottom: 12px; }
.threshold-title { display: block; font-size: 16px; font-weight: 600; color: #333; }
.threshold-desc { display: block; font-size: 12px; color: #999; margin-top: 4px; }
.threshold-options { display: flex; gap: 10px; flex-wrap: wrap; }
.threshold-btn { padding: 10px 16px; border-radius: 10px; background: #f5f7fa; color: #666; font-weight: 600; cursor: pointer; }
.threshold-btn.active { background: #667eea; color: white; }
.threshold-btn.disabled { opacity: 0.48; }
.more-card { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.more-info { flex: 1; }
.more-title { display: block; font-size: 16px; font-weight: 600; color: #333; }
.more-desc { display: block; font-size: 12px; color: #999; margin-top: 4px; }
.more-arrow { font-size: 20px; color: #ccc; }
</style>
