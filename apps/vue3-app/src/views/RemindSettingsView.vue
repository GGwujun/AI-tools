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
  { key: 'fund_arbitrage_enabled', label: '溢价机会' },
  { key: 'realtime_premium_enabled', label: '限额申购' },
  { key: 'morning_subscribe_enabled', label: '申购状态变化' },
  { key: 'convertible_bond_list_enabled', label: '到账提醒' },
  { key: 'convertible_bond_redeem_enabled', label: '可转债提醒' },
  { key: 'convertible_bond_expected_redeem_enabled', label: '双低区间' },
  { key: 'convertible_bond_lag_enabled', label: '强赎预警' },
  { key: 'closed_fund_discount_enabled', label: '折价机会' },
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

function goToBindMobile() {
  router.push('/login')
}

onMounted(() => {
  void loadSettings()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back()"></button>
      <div class="title">高级提醒设置</div>
    </header>

    <section v-if="needsMobileBinding" class="binding-card">
      <strong>绑定手机号后才能开启高级提醒</strong>
      <p>高级提醒会关联你的个人提醒配置与后续通知触达。请先完成手机号绑定，再继续配置。</p>
      <button class="binding-btn" @click="goToBindMobile">去绑定手机号</button>
    </section>

    <section class="card">
      <h2>提醒类型</h2>
      <div v-if="error" class="hint error-text">{{ error }}</div>
      <div v-else-if="loading" class="hint">正在加载提醒设置...</div>
      <div v-else class="icon-grid">
        <button
          v-for="item in toggleItems"
          :key="item.key"
          :class="['icon-item', { active: settings?.[item.key] }]"
          :disabled="needsMobileBinding"
          @click="toggleSetting(item.key)"
        >
          <span class="badge"></span>
          <strong>{{ item.label }}</strong>
        </button>
      </div>
    </section>

    <section class="card">
      <h2>提醒条件</h2>
      <div class="field"><span>标的</span><strong>鹏华中证传媒LOF 160629</strong></div>
      <div class="field"><span>溢价率</span><strong>高于 {{ settings?.premium_threshold ?? 2.0 }}%</strong></div>
      <div class="field"><span>触发频率</span><strong>每日一次</strong></div>
      <div class="field"><span>提醒时间</span><strong>09:00-21:00</strong></div>
    </section>

    <section class="card">
      <h2>通知方式</h2>
      <div class="switch-row">
        <span>公众号服务通知</span>
        <span class="switch active"></span>
      </div>
      <div class="switch-row">
        <span>模板消息（可选）</span>
        <span class="switch active"></span>
      </div>
    </section>

    <footer class="footer">
      <button class="primary" :disabled="needsMobileBinding" @click="persist">{{ saving ? '保存中...' : '保存提醒' }}</button>
    </footer>
  </div>
</template>

<style scoped>
.page { min-height:100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 92px; background: var(--lof-bg); }
.topbar { display:grid; grid-template-columns:18px 1fr 18px; align-items:center; margin-bottom:14px; }
.title { text-align:center; font-size:18px; font-weight:700; }
.back { width:18px; height:18px; border:0; background:none; position:relative; }
.back::before { content:''; position:absolute; left:2px; top:7px; width:10px; height:10px; border-left:2px solid #1f3348; border-bottom:2px solid #1f3348; transform:rotate(45deg); }
.binding-card { margin-top:14px; padding:16px; border-radius:22px; background:#fff7ed; box-shadow:var(--lof-shadow); }
.binding-card strong { display:block; color:#9a3412; font-size:15px; }
.binding-card p { margin-top:8px; color:#9a3412; font-size:12px; line-height:1.7; }
.binding-btn { margin-top:12px; height:40px; padding:0 14px; border:0; border-radius:12px; background:#ea580c; color:#fff; font-size:13px; font-weight:700; }
.card { margin-top:14px; padding:16px; border-radius:22px; background:#fff; box-shadow:var(--lof-shadow); }
.card h2 { font-size:16px; margin-bottom:12px; }
.hint { font-size:13px; color:var(--lof-muted); }
.error-text { color:#dc2626; }
.icon-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.icon-item { padding:12px 8px; border:1px solid var(--lof-border); border-radius:18px; text-align:center; background:#fff; }
.icon-item:disabled { opacity:.48; }
.icon-item.active { background:#eef8f5; border-color:rgba(20, 159, 135, .28); }
.badge { display:block; width:26px; height:26px; margin:0 auto 8px; border-radius:10px; background:linear-gradient(180deg, #f4f8fb 0%, #dde7f0 100%); }
.icon-item.active .badge { background:linear-gradient(180deg, #9de3d2 0%, #16ac93 100%); }
.icon-item strong { font-size:11px; }
.field, .switch-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--lof-border); font-size:13px; gap:12px; }
.field:last-child, .switch-row:last-child { border-bottom:0; }
.field span, .switch-row span:first-child { color:var(--lof-muted); }
.switch { width:42px; height:24px; border-radius:999px; background:#d5dde6; position:relative; }
.switch::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.12); }
.switch.active { background:var(--lof-primary); }
.switch.active::after { left:20px; }
.footer { position:fixed; left:0; right:0; bottom:0; padding:14px 16px calc(14px + env(safe-area-inset-bottom)); background:rgba(255,255,255,.95); border-top:1px solid var(--lof-border); }
.primary { width:100%; height:48px; border:0; border-radius:16px; background:linear-gradient(180deg, #16ac93 0%, #10947d 100%); color:#fff; font-size:16px; font-weight:700; }
.primary:disabled { opacity:.48; }
</style>
