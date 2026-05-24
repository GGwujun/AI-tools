<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveWatchlist, type SaveWatchlistResponse } from '@/lib/save-api'
import { useLofH5Store } from '@/stores/lofH5'

const router = useRouter()
const deviceId = getDeviceId()
const lofStore = useLofH5Store()

const loading = ref(false)
const error = ref('')
const response = ref<SaveWatchlistResponse | null>(null)

const segmentTabs = [
  { key: 'all', label: '全部' },
  { key: 'fund', label: '基金套利' },
  { key: 'bond', label: '可转债' },
] as const

const visibleItems = computed(() => {
  const items = response.value?.items ?? []
  if (lofStore.watchlistSegment === 'all') return items
  return items.filter((item) => item.type === lofStore.watchlistSegment)
})

const summaryItems = computed(() => {
  const summary = response.value?.summary
  return [
    { label: '基金自选', value: String(summary?.funds ?? 0) },
    { label: '转债自选', value: String(summary?.bonds ?? 0) },
    { label: '今日异动', value: String(summary?.changed ?? 0) },
    { label: '待处理提醒', value: String(summary?.pending ?? 0) },
  ]
})

async function loadWatchlist() {
  loading.value = true
  error.value = ''
  try {
    response.value = await fetchSaveWatchlist(deviceId)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openDetail(item: { code: string; type: 'fund' | 'bond'; market_type?: string | null }) {
  if (item.type === 'bond') {
    router.push({ path: '/save/bond-detail/core', query: { code: item.code } })
    return
  }
  router.push({ path: '/save/fund-detail/core', query: { code: item.code, marketType: item.market_type || 'stock_lof' } })
}

onMounted(() => {
  void loadWatchlist()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>我的自选</h1>
        <p>统一查看你关注的基金与转债</p>
      </div>
      <button class="ghost-btn" @click="router.push('/')">去看今日机会</button>
    </header>

    <nav class="segment-tabs">
      <button
        v-for="item in segmentTabs"
        :key="item.key"
        :class="['segment-btn', { active: lofStore.watchlistSegment === item.key }]"
        @click="lofStore.watchlistSegment = item.key"
      >
        {{ item.label }}
      </button>
    </nav>

    <section class="summary-card">
      <article v-for="item in summaryItems" :key="item.label" class="summary-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </section>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="state-card">正在加载自选数据...</section>
    <section v-else-if="visibleItems.length === 0" class="state-card">
      你还没有添加自选。先把关注的基金或转债加入自选，后续更方便接收提醒。
    </section>

    <section v-else class="card-list">
      <article
        v-for="item in visibleItems"
        :key="item.code"
        class="watch-card"
        @click="openDetail(item)"
      >
        <div class="card-head">
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.code }} · {{ item.type === 'fund' ? '基金套利' : '可转债' }}</p>
          </div>
          <span class="badge">{{ item.badge }}</span>
        </div>
        <div class="card-body">
          <div>
            <strong :class="item.type === 'fund' ? 'text-danger' : 'text-success'">{{ item.change }}</strong>
            <p>{{ item.subtitle }}</p>
          </div>
          <svg class="chart" viewBox="0 0 80 28" preserveAspectRatio="none">
            <polyline
              :stroke="item.chart_color"
              fill="none"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              :points="item.chart.map((v, i) => `${i * 11.4},${28 - v / 2.3}`).join(' ')"
            />
          </svg>
        </div>
        <div class="card-foot">
          <span>{{ item.time }}</span>
          <span class="detail-link">查看详情</span>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) 16px calc(92px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, rgba(74, 144, 226, 0.14), transparent 32%),
    #1a1e2b;
}
.topbar,
.card-head,
.card-body,
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.topbar {
  align-items: flex-start;
}
.topbar h1 {
  color: var(--lof-text);
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
}
.topbar p,
.card-head p,
.card-body p,
.card-foot span {
  color: var(--lof-muted);
  font-size: 12px;
  line-height: 18px;
}
.ghost-btn {
  min-height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  font-size: 12px;
  font-weight: 700;
}
.segment-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.segment-btn {
  min-height: 40px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--lof-muted);
  font-size: 12px;
  font-weight: 600;
}
.segment-btn.active {
  border-color: rgba(74, 144, 226, 0.28);
  background: rgba(74, 144, 226, 0.18);
  color: var(--lof-text);
}
.summary-card,
.watch-card,
.state-card {
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  background: rgba(36, 43, 61, 0.94);
  box-shadow: var(--lof-shadow);
}
.summary-card {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}
.summary-item {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
}
.summary-item span {
  display: block;
  color: var(--lof-muted);
  font-size: 11px;
  line-height: 16px;
}
.summary-item strong {
  display: block;
  margin-top: 4px;
  color: var(--lof-link);
  font-size: 22px;
  line-height: 26px;
  font-weight: 700;
}
.state-card {
  padding: 20px;
  text-align: center;
  color: var(--lof-muted);
  font-size: 13px;
  line-height: 20px;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.watch-card {
  padding: 14px;
}
.watch-card h3 {
  color: var(--lof-text);
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  font-size: 11px;
  font-weight: 700;
}
.card-body {
  margin-top: 12px;
}
.card-body strong {
  display: block;
  font-size: 24px;
  line-height: 28px;
  font-weight: 700;
}
.chart {
  width: 104px;
  height: 36px;
  flex: 0 0 auto;
}
.detail-link {
  color: var(--lof-link) !important;
  font-weight: 700;
}
.text-danger {
  color: var(--lof-danger);
}
.text-success {
  color: var(--lof-success);
}
@media (max-width: 380px) {
  .summary-card,
  .segment-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .topbar,
  .card-head,
  .card-body,
  .card-foot {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
