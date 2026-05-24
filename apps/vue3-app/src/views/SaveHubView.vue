<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchSaveHome, type SaveHomeResponse } from '@/lib/save-api'
import { getDeviceId } from '@/lib/device'
import { useLofH5Store } from '@/stores/lofH5'

const router = useRouter()
const lofStore = useLofH5Store()
const deviceId = getDeviceId()

const loading = ref(false)
const error = ref('')
const home = ref<SaveHomeResponse | null>(null)

const marketStatus = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const total = hour * 60 + minute
  const open = day >= 1 && day <= 5 && ((total >= 570 && total <= 690) || (total >= 780 && total <= 900))
  return open ? '开盘中' : '非开盘'
})

const quickLinks = [
  { key: 'opportunity', title: '今日机会', note: '查看全部套利列表', path: '/save/arbitrage' },
  { key: 'watchlist', title: '我的自选', note: '查看关注标的变化', path: '/watchlist' },
  { key: 'settings', title: '高级设置', note: '提醒与偏好配置', path: '/save/remind-settings' },
  { key: 'notice', title: '数据说明', note: '估值、费率与风险口径', path: '/save/warm-notice' },
] as const

const summaryItems = computed(() => {
  const sections = home.value?.sections ?? []
  const lookup = new Map(sections.map((section) => [section.key, section.items.length]))
  return [
    { label: '股债型LOF', value: String(lookup.get('stock_lof') ?? 0) },
    { label: '指数型LOF', value: String(lookup.get('index_lof') ?? 0) },
    { label: '无时差ETF', value: String(lookup.get('etf') ?? 0) },
    { label: '可转债', value: String(lookup.get('bond') ?? 0) },
  ]
})

const sourceHints = computed(() => [
  '估值来源可能为官方净值、盘中估算或 IOPV，请以详情页显示为准。',
  '费率资料存在真实源、页面解析与规则估算三种来源。',
  'QDII 与跨市场基金存在时差与汇率风险，盘中观察需额外谨慎。',
])

async function loadHome() {
  loading.value = true
  error.value = ''
  try {
    home.value = await fetchSaveHome(lofStore.homeCategory, deviceId)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function open(path: string) {
  router.push(path)
}

function triggerSync() {
  router.push('/save/warm-notice')
}

onMounted(() => {
  void loadHome()
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-copy">
        <h1>套利监控</h1>
        <p>基金套利与可转债监测入口</p>
      </div>
    </header>

    <section v-if="error" class="panel state-panel">{{ error }}</section>
    <section v-else-if="loading" class="panel state-panel">正在加载首页...</section>

    <template v-else-if="home">
      <section class="panel status-panel">
        <div class="status-row">
          <div>
            <span class="status-label">最近同步时间</span>
            <strong>{{ home.update_time || '--' }}</strong>
          </div>
          <span :class="['market-pill', { active: marketStatus === '开盘中' }]">{{ marketStatus }}</span>
        </div>
        <button class="sync-btn" @click="triggerSync">查看同步与数据说明</button>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>快速入口</h2>
        </div>
        <div class="quick-grid">
          <button
            v-for="item in quickLinks"
            :key="item.key"
            class="quick-card"
            @click="open(item.path)"
          >
            <strong>{{ item.title }}</strong>
            <p>{{ item.note }}</p>
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>数据覆盖</h2>
        </div>
        <div class="summary-grid">
          <div v-for="item in summaryItems" :key="item.label" class="summary-item">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>来源与风险提示</h2>
        </div>
        <div class="hint-list">
          <p v-for="item in sourceHints" :key="item">{{ item }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(16px + env(safe-area-inset-top)) 16px 18px;
  background: #f5f7fa;
}

.hero-copy h1 {
  color: #132433;
  font-size: 26px;
  line-height: 34px;
  font-weight: 800;
}

.hero-copy p {
  margin-top: 4px;
  color: #8e9aa6;
  font-size: 12px;
  line-height: 18px;
}

.panel {
  margin-top: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e9eef3;
  box-shadow: 0 8px 24px rgba(27, 53, 74, 0.04);
}

.state-panel {
  text-align: center;
  color: #6d7f8e;
  font-size: 13px;
}

.status-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-label {
  display: block;
  color: #7b8894;
  font-size: 11px;
  line-height: 16px;
}

.status-row strong {
  display: block;
  margin-top: 4px;
  color: #203346;
  font-size: 18px;
  line-height: 24px;
  font-weight: 800;
}

.market-pill {
  padding: 5px 10px;
  border-radius: 999px;
  background: #eef2f6;
  color: #6e7f8f;
  font-size: 11px;
  font-weight: 700;
}

.market-pill.active {
  background: #e9f7f3;
  color: #0f8c76;
}

.sync-btn {
  height: 42px;
  border-radius: 14px;
  border: 1px solid #dfe7ee;
  background: #fff;
  color: #203346;
  font-size: 14px;
  font-weight: 600;
}

.section-head h2 {
  color: #182c3e;
  font-size: 16px;
  font-weight: 700;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.quick-card {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #edf2f6;
  background: #fbfdff;
  text-align: left;
}

.quick-card strong {
  display: block;
  color: #203346;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
}

.quick-card p {
  margin-top: 4px;
  color: #81909d;
  font-size: 12px;
  line-height: 18px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.summary-item {
  padding: 12px 8px;
  border-radius: 14px;
  background: #f7fafc;
  text-align: center;
}

.summary-item strong {
  display: block;
  color: #149c8a;
  font-size: 20px;
  line-height: 24px;
  font-weight: 800;
}

.summary-item span {
  display: block;
  margin-top: 4px;
  color: #7f8f9c;
  font-size: 10px;
  line-height: 14px;
}

.hint-list {
  margin-top: 12px;
}

.hint-list p {
  padding: 10px 0;
  border-bottom: 1px solid #edf2f6;
  color: #5f7389;
  font-size: 13px;
  line-height: 1.7;
}

.hint-list p:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
</style>
