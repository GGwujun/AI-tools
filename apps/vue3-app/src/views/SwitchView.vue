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

const toggleCards: Array<{ key: ToggleKey; title: string; note: string }> = [
  { key: 'master_enabled', title: '提醒总开关', note: '统一控制所有基础提醒能力' },
  { key: 'market_enabled', title: '大盘异动', note: '市场整体波动时给出提醒' },
  { key: 'followed_enabled', title: '关注标的', note: '对你重点跟踪的基金触发提醒' },
  { key: 'optional_enabled', title: '自选提醒', note: '自选标的达到阈值时推送提醒' },
]

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
    <header class="topbar">
      <button class="nav-btn" @click="router.back()">‹</button>
      <div class="title-block">
        <span class="kicker">基础提醒能力</span>
        <h1>提醒总开关</h1>
        <p>先定提醒边界，再决定高级策略怎么推送。</p>
      </div>
      <div class="topbar-space"></div>
    </header>

    <section v-if="needsMobileBinding" class="notice-card warning">
      <strong>绑定手机号后才能开启提醒服务</strong>
      <p>提醒总开关、阈值设置和高级提醒配置都依赖手机号身份。请先绑定手机号，再继续设置。</p>
      <button class="warning-btn" @click="router.push('/login')">去绑定手机号</button>
    </section>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="state-card">正在加载提醒设置...</section>

    <template v-else>
      <section class="hero-panel">
        <div class="hero-copy">
          <strong>{{ settings.master_enabled ? '当前提醒已开启' : '当前提醒已关闭' }}</strong>
          <p>{{ settings.master_enabled ? '达到阈值后会记录并触发提醒。' : '关闭后，基础提醒与阈值触发都不会生效。' }}</p>
        </div>
        <button class="hero-toggle" :class="{ active: settings.master_enabled }" @click="toggle('master_enabled')">
          {{ settings.master_enabled ? '已开启' : '已关闭' }}
        </button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>提醒范围</h2>
          <span>只保留你真正需要关注的提醒</span>
        </div>
        <div class="toggle-grid">
          <button
            v-for="item in toggleCards.slice(1)"
            :key="item.key"
            :class="['toggle-card', { active: settings[item.key] }]"
            @click="toggle(item.key)"
          >
            <strong>{{ item.title }}</strong>
            <p>{{ item.note }}</p>
            <span class="card-state">{{ settings[item.key] ? '开启' : '关闭' }}</span>
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>提醒阈值</h2>
          <span>涨跌达到设定阈值时触发提醒</span>
        </div>
        <div class="chip-wrap">
          <button
            v-for="threshold in thresholds"
            :key="threshold"
            :class="['chip', { active: settings.alert_threshold === threshold }]"
            @click="selectThreshold(threshold)"
          >
            {{ threshold }}%
          </button>
        </div>
      </section>

      <section class="panel row-btn" @click="router.push('/save/remind-settings')">
        <div>
          <strong>高级提醒设置</strong>
          <p>继续细分套利、折价、强赎和到账类提醒。</p>
        </div>
        <span class="arrow">›</span>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) 16px calc(88px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, rgba(74, 144, 226, 0.16), transparent 32%),
    #1a1e2b;
}
.topbar,
.panel-head,
.row-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nav-btn,
.warning-btn,
.chip,
.toggle-card,
.hero-toggle {
  font: inherit;
  cursor: pointer;
}
.nav-btn {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 12px;
  background: rgba(36, 43, 61, 0.9);
  color: var(--lof-text);
  font-size: 24px;
}
.title-block { flex: 1; }
.kicker {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(74, 144, 226, 0.12);
  color: #c8ddff;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.title-block h1,
.panel h2,
.hero-copy strong,
.toggle-card strong,
.row-btn strong {
  color: var(--lof-text);
  font-weight: 800;
}
.title-block h1 {
  margin-top: 6px;
  font-size: 22px;
  line-height: 28px;
}
.title-block p,
.panel-head span,
.toggle-card p,
.row-btn p,
.notice-card p,
.state-card,
.hero-copy p {
  color: var(--lof-muted);
  font-size: 12px;
  line-height: 18px;
}
.topbar-space { width: 38px; }
.notice-card,
.hero-panel,
.panel,
.state-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02)),
    rgba(36, 43, 61, 0.96);
  box-shadow: var(--lof-shadow);
}
.warning {
  background: linear-gradient(180deg, rgba(234, 88, 12, 0.16), rgba(255,255,255,0.03)), rgba(36,43,61,0.96);
}
.notice-card strong {
  display: block;
  color: #ffd0ba;
  font-size: 15px;
  line-height: 22px;
}
.warning-btn {
  min-height: 40px;
  margin-top: 12px;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: #ea580c;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}
.state-card { text-align: center; }
.hero-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.hero-copy { flex: 1; }
.hero-toggle {
  min-width: 92px;
  min-height: 40px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  color: var(--lof-muted);
  font-size: 13px;
  font-weight: 700;
}
.hero-toggle.active {
  background: rgba(74, 144, 226, 0.18);
  color: #dceaff;
  border-color: rgba(74, 144, 226, 0.2);
}
.toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.toggle-card {
  padding: 14px 12px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 16px;
  background: rgba(255,255,255,0.035);
  text-align: left;
}
.toggle-card.active {
  border-color: rgba(74, 144, 226, 0.2);
  background: rgba(74, 144, 226, 0.12);
}
.card-state {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  margin-top: 10px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  color: var(--lof-muted);
  font-size: 11px;
  font-weight: 700;
}
.toggle-card.active .card-state {
  background: rgba(74, 144, 226, 0.16);
  color: #dceaff;
}
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.chip {
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  color: var(--lof-muted);
  font-size: 12px;
  font-weight: 700;
}
.chip.active {
  border-color: rgba(74, 144, 226, 0.22);
  background: rgba(74, 144, 226, 0.18);
  color: #dceaff;
}
.row-btn { cursor: pointer; }
.arrow {
  color: #8d97aa;
  font-size: 18px;
}
@media (max-width: 380px) {
  .hero-panel,
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .toggle-grid {
    grid-template-columns: 1fr;
  }
}
</style>
