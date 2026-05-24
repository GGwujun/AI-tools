<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveSettings, updateAdvancedSettings, type AdvancedSettings } from '@/lib/save-api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const deviceId = getDeviceId()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const settings = ref<AdvancedSettings | null>(null)
const needsMobileBinding = computed(() => authStore.isLoggedIn && authStore.user?.mobile_bound !== true)

const toggleItems = computed(() => [
  { key: 'fund_arbitrage_enabled', label: '溢价机会', note: '盘中溢价超过阈值时提醒' },
  { key: 'closed_fund_discount_enabled', label: '折价机会', note: '折价区间扩张时提醒' },
  { key: 'realtime_premium_enabled', label: '限额申购', note: '限额与申购状态变化提醒' },
  { key: 'morning_subscribe_enabled', label: '申购状态', note: '开放、暂停、限额切换提醒' },
  { key: 'convertible_bond_list_enabled', label: '到账提醒', note: '基金到账与可卖时间提醒' },
  { key: 'convertible_bond_lag_enabled', label: '强赎预警', note: '可转债强赎风险变化提醒' },
  { key: 'convertible_bond_expected_redeem_enabled', label: '双低区间', note: '双低变化进入关注区间时提醒' },
  { key: 'convertible_bond_redeem_enabled', label: '转债提醒', note: '转债列表异动和重点事件提醒' },
] as const)

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetchSaveSettings(deviceId)
    settings.value = response.advanced_settings
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function persist() {
  if (!settings.value || needsMobileBinding.value) return
  saving.value = true
  error.value = ''
  try {
    const response = await updateAdvancedSettings(deviceId, settings.value)
    settings.value = response.advanced_settings
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '保存失败'
  } finally {
    saving.value = false
  }
}

function toggleSetting(key: keyof AdvancedSettings) {
  if (!settings.value || needsMobileBinding.value || typeof settings.value[key] !== 'boolean') return
  settings.value = {
    ...settings.value,
    [key]: !settings.value[key] as never,
  }
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
        <span class="kicker">高级提醒配置</span>
        <h1>高级提醒设置</h1>
        <p>把提醒从“是否推送”，进一步细分成“什么时候推送”。</p>
      </div>
      <div class="topbar-space"></div>
    </header>

    <section v-if="needsMobileBinding" class="notice-card warning">
      <strong>绑定手机号后才能开启高级提醒</strong>
      <p>高级提醒会关联你的个人配置与后续通知触达。请先完成手机号绑定，再继续配置。</p>
      <button class="warning-btn" @click="router.push('/login')">去绑定手机号</button>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>提醒类型</h2>
        <span>按需开启，避免信息过载</span>
      </div>
      <div v-if="error" class="state-line">{{ error }}</div>
      <div v-else-if="loading" class="state-line">正在加载提醒设置...</div>
      <div v-else class="toggle-list">
        <button
          v-for="item in toggleItems"
          :key="item.key"
          :class="['toggle-row', { active: settings?.[item.key] }]"
          :disabled="needsMobileBinding"
          @click="toggleSetting(item.key)"
        >
          <div>
            <strong>{{ item.label }}</strong>
            <p>{{ item.note }}</p>
          </div>
          <span class="toggle-state">{{ settings?.[item.key] ? '开启' : '关闭' }}</span>
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>提醒条件</h2>
        <span>当前使用的关键阈值</span>
      </div>
      <div class="metrics-grid">
        <article class="metric-card">
          <span>溢价阈值</span>
          <strong>{{ settings?.premium_threshold ?? '--' }}%</strong>
        </article>
        <article class="metric-card">
          <span>折价阈值</span>
          <strong>{{ settings?.discount_threshold ?? '--' }}%</strong>
        </article>
        <article class="metric-card">
          <span>成交额阈值</span>
          <strong>{{ settings?.turnover_threshold ?? '--' }}</strong>
        </article>
        <article class="metric-card">
          <span>盘口阈值</span>
          <strong>{{ settings?.realtime_premium_threshold ?? '--' }}%</strong>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>通知方式</h2>
      </div>
      <div class="row-item"><span>公众号服务通知</span><strong>{{ needsMobileBinding ? '绑定后可用' : '按主配置触达' }}</strong></div>
      <div class="row-item"><span>提醒频率</span><strong>按阈值触发后汇总展示</strong></div>
    </section>

    <footer class="bottom-bar">
      <button class="primary-btn" :disabled="needsMobileBinding" @click="persist">{{ saving ? '保存中...' : '保存提醒' }}</button>
    </footer>
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
.row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nav-btn,
.warning-btn,
.primary-btn,
.toggle-row {
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
.toggle-row strong,
.metric-card strong {
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
.state-line,
.row-item span,
.notice-card p,
.toggle-row p,
.metric-card span {
  color: var(--lof-muted);
  font-size: 12px;
  line-height: 18px;
}
.topbar-space { width: 38px; }
.notice-card,
.panel {
  margin-top: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02)),
    rgba(36, 43, 61, 0.96);
  box-shadow: var(--lof-shadow);
}
.notice-card strong {
  display: block;
  color: #ffd0ba;
  font-size: 15px;
  line-height: 22px;
}
.warning {
  background: linear-gradient(180deg, rgba(234, 88, 12, 0.16), rgba(255,255,255,0.03)), rgba(36,43,61,0.96);
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
.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 12px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 16px;
  background: rgba(255,255,255,0.035);
  text-align: left;
}
.toggle-row.active {
  border-color: rgba(74, 144, 226, 0.2);
  background: rgba(74, 144, 226, 0.12);
}
.toggle-state {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  color: var(--lof-muted);
  font-size: 11px;
  font-weight: 700;
}
.toggle-row.active .toggle-state {
  background: rgba(74, 144, 226, 0.16);
  color: #dceaff;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.metric-card {
  padding: 14px 12px;
  border-radius: 16px;
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(234, 236, 240, 0.05);
}
.metric-card strong {
  display: block;
  margin-top: 6px;
  font-size: 16px;
  line-height: 22px;
}
.row-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(234,236,240,0.08);
}
.row-item:last-child { border-bottom: 0; }
.row-item strong {
  color: var(--lof-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
}
.bottom-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, calc(100vw - 20px));
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  background: rgba(22, 26, 35, 0.96);
  border-top: 1px solid rgba(234,236,240,0.08);
}
.primary-btn {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, #2d6bc4 0%, #4a90e2 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}
.primary-btn:disabled { opacity: 0.5; }
@media (max-width: 380px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
