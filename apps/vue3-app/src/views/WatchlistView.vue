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
  { key: 'fund', label: '基金' },
  { key: 'bond', label: '转债' },
] as const

const visibleItems = computed(() => {
  const items = response.value?.items ?? []
  if (lofStore.watchlistSegment === 'all') return items
  return items.filter((item) => item.type === lofStore.watchlistSegment)
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
      <h1>自选</h1>
      <div></div>
    </header>

    <nav class="segment-tabs">
      <button
        v-for="item in segmentTabs"
        :key="item.key"
        :class="{ active: lofStore.watchlistSegment === item.key }"
        @click="lofStore.watchlistSegment = item.key"
      >
        {{ item.label }}
      </button>
    </nav>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="state-card">正在加载自选数据...</section>

    <section v-else class="list">
      <article
        v-for="item in visibleItems"
        :key="item.code"
        class="watch-card"
        @click="openDetail(item)"
      >
        <div class="card-head">
          <div class="name-block">
            <strong>{{ item.name }}</strong>
            <p>{{ item.code }}</p>
          </div>
          <button class="star" :class="{ active: item.starred }" @click.stop="lofStore.toggleFavorite(item.code)"></button>
        </div>

        <div class="card-main">
          <div class="left">
            <div class="primary" :class="{ red: item.type === 'fund', green: item.type === 'bond' }">{{ item.change }}</div>
            <div class="secondary">{{ item.subtitle }}</div>
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
          <span class="badge">{{ item.badge }}</span>
          <span class="time">{{ item.time }}</span>
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
  padding: calc(16px + env(safe-area-inset-top)) 16px 12px;
  background:
    radial-gradient(circle at top, rgba(227, 246, 248, 0.88) 0, rgba(255, 255, 255, 0) 34%),
    linear-gradient(180deg, #fbfdfd 0%, #f4f8fb 100%);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topbar h1 {
  color: #162839;
  font-size: 24px;
  line-height: 32px;
  font-weight: 800;
}

.segment-tabs {
  display: flex;
  gap: 20px;
  margin-top: 14px;
  padding: 0 2px 10px;
  border-bottom: 1px solid #edf2f6;
}

.segment-tabs button {
  position: relative;
  border: 0;
  background: none;
  color: #718290;
  font-size: 14px;
  font-weight: 600;
}

.segment-tabs button.active {
  color: #149c8a;
}

.segment-tabs button.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -11px;
  height: 3px;
  border-radius: 999px;
  background: #149c8a;
}

.state-card {
  margin-top: 14px;
  padding: 20px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(27, 53, 74, 0.08);
  text-align: center;
  color: #6d7f8e;
  font-size: 13px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.watch-card {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 28px rgba(27, 53, 74, 0.08);
  cursor: pointer;
}

.card-head,
.card-main,
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.name-block strong {
  color: #1c3042;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
}

.name-block p {
  margin-top: 4px;
  color: #81909d;
  font-size: 12px;
  line-height: 16px;
}

.star {
  width: 20px;
  height: 20px;
  border: 1px solid #d3dde5;
  background: #fff;
  clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 72%, 21% 92%, 32% 57%, 2% 35%, 39% 35%);
}

.star.active {
  background: #f6d76d;
  border-color: #f6d76d;
}

.card-main {
  margin-top: 12px;
  gap: 12px;
}

.left {
  min-width: 0;
}

.primary {
  font-size: 24px;
  line-height: 28px;
  font-weight: 800;
}

.primary.red {
  color: #ff5a5f;
}

.primary.green {
  color: #20a066;
}

.secondary {
  margin-top: 4px;
  color: #80909d;
  font-size: 12px;
  line-height: 16px;
}

.chart {
  width: 104px;
  height: 36px;
  flex: 0 0 auto;
}

.card-foot {
  margin-top: 12px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef8f5;
  color: #149c8a;
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
}

.time {
  color: #8ea0ad;
  font-size: 11px;
  line-height: 16px;
}
</style>
