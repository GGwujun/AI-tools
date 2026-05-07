<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveFunds, updateFavorite, type SaveFundItem, type SaveFundListResponse } from '@/lib/save-api'
import { useLofH5Store } from '@/stores/lofH5'

const router = useRouter()
const deviceId = getDeviceId()
const lofStore = useLofH5Store()

const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const response = ref<SaveFundListResponse | null>(null)
const items = ref<SaveFundItem[]>([])
const page = ref(1)
const pageSize = 8
const loadMoreRef = ref<HTMLElement | null>(null)
const sortKey = ref<'name' | 'premium'>('premium')
const sortOrder = ref<'asc' | 'desc'>('desc')
let observer: IntersectionObserver | null = null

const categoryTabs = [
  { key: 'stock_lof', label: '股票型LOF' },
  { key: 'index_lof', label: '指数型LOF' },
  { key: 'etf', label: '无时差ETF' },
  { key: 'bond', label: '可转债' },
] as const

const sortedItems = computed(() => {
  const sorted = [...items.value]
  sorted.sort((a, b) => {
    if (sortKey.value === 'name') {
      const result = a.name.localeCompare(b.name, 'zh-CN')
      return sortOrder.value === 'asc' ? result : -result
    }
    const aValue = parseFloat(a.premium_display) || 0
    const bValue = parseFloat(b.premium_display) || 0
    return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
  })
  return sorted
})

const visibleItems = computed(() => sortedItems.value)
const hasMore = computed(() => response.value?.has_more === true)

async function loadList(reset = true) {
  if (reset) {
    loading.value = true
    error.value = ''
    page.value = 1
  } else {
    loadingMore.value = true
  }

  try {
    const nextPage = reset ? 1 : page.value + 1
    const result = await fetchSaveFunds(lofStore.homeCategory, deviceId, { page: nextPage, pageSize })
    response.value = result
    page.value = result.page ?? nextPage
    items.value = reset ? result.funds : [...items.value, ...result.funds]
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
    await nextTick()
    bindObserver()
  }
}

function changeTab(key: 'stock_lof' | 'index_lof' | 'etf' | 'bond') {
  lofStore.setHomeCategory(key)
  void loadList()
}

function openDetail(item: SaveFundItem) {
  if (item.market_type === 'bond') {
    router.push({ path: '/save/bond-detail/core', query: { code: item.code } })
    return
  }
  router.push({
    path: '/save/fund-detail/core',
    query: { code: item.code, marketType: item.market_type },
  })
}

async function toggleFavorite(item: SaveFundItem) {
  try {
    const starred = !item.starred
    await updateFavorite(item.code, item.market_type, deviceId, starred)
    item.starred = starred
    lofStore.toggleFavorite(item.code)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '更新自选失败'
  }
}

function toggleSort(key: 'name' | 'premium') {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = key === 'name' ? 'asc' : 'desc'
  }
}

function sortArrow(key: 'name' | 'premium') {
  if (sortKey.value !== key) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

function loadNextPage() {
  if (!hasMore.value || loading.value || loadingMore.value) return
  void loadList(false)
}

function bindObserver() {
  if (observer) observer.disconnect()
  if (!loadMoreRef.value || !hasMore.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) loadNextPage()
  }, { rootMargin: '120px' })
  observer.observe(loadMoreRef.value)
}

watch(hasMore, async () => {
  await nextTick()
  bindObserver()
})

onMounted(() => {
  void loadList()
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <button class="back" @click="router.back()"></button>
      <div class="hero-copy">
        <h1>今日机会</h1>
        <p>数据更新时间：{{ response?.update_time || '--' }} <span class="refresh"></span></p>
      </div>
      <div></div>
    </header>

    <nav class="tabs">
      <button
        v-for="item in categoryTabs"
        :key="item.key"
        :class="['tab', { active: lofStore.homeCategory === item.key }]"
        @click="changeTab(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="state-card">正在加载机会列表...</section>

    <section v-else class="table-card first-table">
      <div class="table-head">
        <button class="head-btn name-col" @click="toggleSort('name')">基金名称 {{ sortArrow('name') }}</button>
        <button class="head-btn mini-col" @click="toggleSort('premium')">溢价率 {{ sortArrow('premium') }}</button>
        <span class="mini-col">场内价格</span>
        <span class="favorite-col">自选</span>
      </div>

      <article
        v-for="item in visibleItems"
        :key="item.code"
        class="table-row"
        @click="openDetail(item)"
      >
        <div class="name-col row-main">
          <div class="name-copy">
            <strong>{{ item.name }}</strong>
            <p>{{ item.code }}</p>
          </div>
        </div>

        <div class="mini-col data-cell premium-cell">
          <strong class="danger premium-main">{{ item.market_type === 'bond' ? item.market_price_display : item.premium_display }}</strong>
          <small class="premium-sub">{{ item.market_type === 'bond' ? '双低参考' : (item.nav_price_display || '--') }}</small>
        </div>

        <div class="mini-col data-cell">
          <strong>{{ item.market_price_display }}</strong>
          <small>{{ item.market_type === 'bond' ? item.fund_state : (item.market_change_display && item.market_change_display !== '--' ? `(${item.market_change_display})` : '--') }}</small>
        </div>

        <div class="favorite-col data-cell favorite-cell">
          <button
            class="favorite-switch"
            :class="{ active: item.starred }"
            @click.stop="toggleFavorite(item)"
            :aria-label="item.starred ? '移除自选' : '加入自选'"
            :aria-pressed="item.starred"
          >
            <span class="switch-track">
              <span class="switch-thumb"></span>
            </span>
          </button>
        </div>
      </article>

      <div ref="loadMoreRef" class="load-more">
        <p v-if="loadingMore">正在加载更多...</p>
        <p v-else-if="hasMore">继续上滑加载更多...</p>
        <template v-else>
          <p>- 已展示全部数据 -</p>
          <small>限额/状态等详细信息请进入详情页查看，仅供参考。</small>
        </template>
      </div>
    </section>

    <footer class="bottom-bar">
      <button class="bottom-btn">查看详情页中的条件参考</button>
      <button class="bottom-btn">在详情页查看节奏/风险</button>
      <button class="bottom-btn primary">批量加入自选</button>
    </footer>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(8px + env(safe-area-inset-top)) 10px calc(76px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, rgba(227, 246, 248, 0.9) 0, rgba(255, 255, 255, 0) 33%),
    linear-gradient(180deg, #fbfdfd 0%, #f4f8fb 100%);
}

.hero {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 6px;
}

.back {
  border: 0;
  background: none;
  width: 16px;
  height: 16px;
  position: relative;
}

.back::before {
  content: '';
  position: absolute;
  left: 1px;
  top: 1px;
  width: 10px;
  height: 10px;
  border-left: 2px solid #15273a;
  border-bottom: 2px solid #15273a;
  transform: rotate(45deg);
}

.hero-copy {
  text-align: center;
}

.hero-copy h1 {
  color: #162839;
  font-size: 18px;
  line-height: 24px;
  font-weight: 800;
}

.hero-copy p {
  margin-top: 1px;
  color: #8794a1;
  font-size: 10px;
  line-height: 14px;
}

.refresh {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-left: 4px;
  border: 1.5px solid #4f7cff;
  border-right-color: transparent;
  border-radius: 50%;
  vertical-align: -2px;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 8px;
  border-bottom: 1px solid #eef2f6;
}

.tab {
  position: relative;
  padding: 9px 0 10px;
  border: 0;
  background: none;
  color: #24384b;
  font-size: 12px;
  font-weight: 600;
}

.tab.active {
  color: #149c8a;
}

.tab.active::after {
  content: '';
  position: absolute;
  left: 30%;
  right: 30%;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: #149c8a;
}

.state-card,
.table-card {
  margin-top: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 5px 14px rgba(27, 53, 74, 0.06);
}

.state-card {
  padding: 14px;
  text-align: center;
  color: #6d7f8e;
  font-size: 12px;
}

.table-card {
  overflow: hidden;
}

.first-table {
  margin-top: 10px;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 2.5fr 0.9fr 0.9fr 0.75fr;
  gap: 6px;
  align-items: center;
  padding: 0 8px;
}

.table-head {
  min-height: 28px;
  background: #f8fbfd;
  color: #97a4b0;
  font-size: 9px;
  font-weight: 600;
}

.head-btn {
  border: 0;
  background: none;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
}

.table-row {
  min-height: 56px;
  border-top: 1px solid #eef2f6;
  cursor: pointer;
}

.row-main {
  display: flex;
  align-items: center;
}

.name-copy strong {
  color: #1b2f42;
  font-size: 12px;
  line-height: 15px;
  font-weight: 700;
}

.name-copy p {
  margin-top: 1px;
  color: #7f8d99;
  font-size: 9px;
  line-height: 12px;
}

.data-cell {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.data-cell strong {
  color: #203447;
  font-size: 12px;
  line-height: 14px;
  white-space: nowrap;
}

.data-cell small {
  color: #96a3af;
  font-size: 9px;
  line-height: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.premium-cell {
  align-items: flex-start;
}

.premium-main,
.premium-sub {
  display: block;
}

.favorite-col {
  text-align: right;
}

.favorite-cell {
  align-items: flex-end;
}

.favorite-switch {
  border: 0;
  background: none;
  padding: 0;
  width: 42px;
  height: 24px;
}

.switch-track {
  position: relative;
  display: block;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #dbe5ec;
  box-shadow: inset 0 0 0 1px rgba(110, 129, 145, 0.12);
  transition: background-color 0.2s ease;
}

.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(24, 44, 62, 0.18);
  transition: transform 0.2s ease;
}

.favorite-switch.active .switch-track {
  background: linear-gradient(90deg, #1ab394 0%, #149c8a 100%);
}

.favorite-switch.active .switch-thumb {
  transform: translateX(18px);
}

.danger {
  color: #ff4f55 !important;
}

.warning {
  color: #f08f28 !important;
}

.load-more {
  padding: 10px 10px 12px;
  text-align: center;
}

.load-more p {
  color: #98a5b0;
  font-size: 11px;
  line-height: 16px;
}

.load-more small {
  display: block;
  margin-top: 1px;
  color: #a6b2bc;
  font-size: 10px;
}

.bottom-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, calc(100vw - 20px));
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 0;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #ebeff3;
  box-shadow: 0 -6px 16px rgba(27, 53, 74, 0.05);
}

.bottom-btn {
  height: 42px;
  border: 0;
  background: #fff;
  color: #1d3042;
  font-size: 11px;
  font-weight: 600;
}

.bottom-btn.primary {
  border-radius: 10px;
  background: linear-gradient(90deg, #149b88 0%, #1f9f8a 100%);
  color: #fff;
}
</style>
