<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import {
  fetchSaveFunds,
  fetchSaveHome,
  updateFavorite,
  type SaveFundItem,
  type SaveFundListResponse,
  type SaveHomeResponse,
} from '@/lib/save-api'
import { useLofH5Store } from '@/stores/lofH5'

type CategoryKey = 'stock_lof' | 'index_lof' | 'etf' | 'bond'
type SortKey = 'premium-desc' | 'premium-asc' | 'name'
type StatusFilterKey = 'all' | 'subscribable' | 'limited' | 'paused' | 'favorite'
type QuickFilterKey = 'all' | 'premium' | 'subscribable' | 'limited' | 'down'

const router = useRouter()
const deviceId = getDeviceId()
const lofStore = useLofH5Store()

const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const response = ref<SaveFundListResponse | null>(null)
const home = ref<SaveHomeResponse | null>(null)
const items = ref<SaveFundItem[]>([])
const page = ref(1)
const pageSize = 10
const filterSheetOpen = ref(false)
const sortKey = ref<SortKey>('premium-desc')
const statusFilter = ref<StatusFilterKey>('all')
const quickFilter = ref<QuickFilterKey>('all')
const loadMoreRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const categoryTabs: Array<{ key: CategoryKey; label: string }> = [
  { key: 'stock_lof', label: '股债型LOF' },
  { key: 'index_lof', label: '指数型LOF' },
  { key: 'etf', label: '无时差ETF' },
  { key: 'bond', label: '可转债' },
]

const quickFilters: Array<{ key: QuickFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'premium', label: '高溢价' },
  { key: 'subscribable', label: '可申购' },
  { key: 'limited', label: '限购' },
  { key: 'down', label: '连跌' },
]

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'premium-desc', label: '溢价优先' },
  { key: 'premium-asc', label: '折价优先' },
  { key: 'name', label: '名称排序' },
]

const statusOptions: Array<{ key: StatusFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'subscribable', label: '可申购' },
  { key: 'limited', label: '限额开放' },
  { key: 'paused', label: '暂停申购' },
  { key: 'favorite', label: '我的自选' },
]

function normalizeCategoryName(label: string) {
  if (label.includes('股票型LOF') || label.includes('股债性LOF')) return '股债型LOF'
  if (label.includes('指数LOF')) return '指数型LOF'
  if (label.includes('无套利ETF') || label.includes('ETF套利')) return '无时差ETF'
  return label
}

const currentTabMeta = computed(() => {
  const fromHome = home.value?.tabs.find((item) => item.key === lofStore.homeCategory)
  const fallback = categoryTabs.find((item) => item.key === lofStore.homeCategory)
  return {
    label: normalizeCategoryName(fromHome?.name || fallback?.label || '股债型LOF'),
    description: fromHome?.description || '实时观察折溢价、申赎状态与盘中偏离',
  }
})

const syncMessage = computed(() => {
  const raw = response.value?.sync_status.message?.trim()
  if (!raw) return '数据可能存在延迟，请结合公告与净值披露综合判断'
  if (raw.includes('invalid input syntax for type json') || raw.includes('Token "NaN" is invalid')) {
    return '部分估值结果暂不可用，请稍后刷新再看'
  }
  if (raw.startsWith('同步失败:') || raw.includes('unsupported operand type')) {
    return '数据同步处理中，部分计算结果暂未更新'
  }
  if (raw.includes('同步完成')) return '数据已更新，可直接查看当前机会'
  if (raw.length > 80) return '数据同步中，请稍后刷新'
  return raw.replace('基金数据', '数据')
})
const updateTime = computed(() => response.value?.update_time || home.value?.update_time || '--')
const activeSortLabel = computed(() => sortOptions.find((item) => item.key === sortKey.value)?.label || '溢价优先')

const summary = computed(() => {
  const currentCount = response.value?.stats.current_count ?? items.value.length
  const premiumCount = items.value.filter((item) => premiumValue(item) >= 1.5).length
  const opportunityCount = items.value.filter((item) => premiumValue(item) <= -0.5 || premiumValue(item) >= 1.5).length
  return {
    currentCount,
    premiumCount,
    opportunityCount,
  }
})

const heroLoading = computed(() => loading.value && !response.value && items.value.length === 0)

const filteredItems = computed(() => {
  let nextItems = [...items.value]

  if (statusFilter.value === 'subscribable') {
    nextItems = nextItems.filter((item) => isSubscribable(item))
  } else if (statusFilter.value === 'limited') {
    nextItems = nextItems.filter((item) => isLimited(item))
  } else if (statusFilter.value === 'paused') {
    nextItems = nextItems.filter((item) => isPaused(item))
  } else if (statusFilter.value === 'favorite') {
    nextItems = nextItems.filter((item) => item.starred)
  }

  if (quickFilter.value === 'premium') {
    nextItems = nextItems.filter((item) => premiumValue(item) >= 1.5)
  } else if (quickFilter.value === 'subscribable') {
    nextItems = nextItems.filter((item) => isSubscribable(item))
  } else if (quickFilter.value === 'limited') {
    nextItems = nextItems.filter((item) => isLimited(item))
  } else if (quickFilter.value === 'down') {
    nextItems = nextItems.filter((item) => item.down_days >= 3)
  }

  nextItems.sort((left, right) => {
    if (sortKey.value === 'name') {
      return left.name.localeCompare(right.name, 'zh-CN')
    }
    return sortKey.value === 'premium-asc'
      ? premiumValue(left) - premiumValue(right)
      : premiumValue(right) - premiumValue(left)
  })

  return nextItems
})

const hasMore = computed(() => response.value?.has_more === true)

function premiumValue(item: SaveFundItem) {
  if (item.market_type === 'bond') return parseFloat(item.market_price_display) || 0
  return item.premium_rate ?? (parseFloat(item.premium_display) || 0)
}

function premiumText(item: SaveFundItem) {
  if (item.market_type === 'bond') return item.market_price_display
  return item.premium_display || '--'
}

function premiumClass(item: SaveFundItem) {
  return premiumValue(item) >= 0 ? 'is-premium' : 'is-discount'
}

function marketChangeClass(item: SaveFundItem) {
  return (item.market_change_pct ?? 0) >= 0 ? 'is-premium' : 'is-discount'
}

function premiumBarWidth(item: SaveFundItem) {
  const width = Math.min(Math.abs(premiumValue(item)) * 22, 100)
  return `${Math.max(width, 18)}%`
}

function isPaused(item: SaveFundItem) {
  return item.paused || item.fund_state.includes('暂停')
}

function isLimited(item: SaveFundItem) {
  return item.fund_state.includes('限额') || item.fund_state.includes('限购')
}

function isSubscribable(item: SaveFundItem) {
  return !isPaused(item) && (item.fund_state.includes('申购') || item.fund_state.includes('开放') || item.market_type === 'bond')
}

function compactFundState(rawState: string) {
  const state = rawState.trim()
  if (!state) return '可申购'
  if (state.includes('场内交易')) return '场内交易'
  if (state.includes('暂停申购')) return '暂停申购'
  if (state.includes('暂停赎回')) return '暂停赎回'
  if (state.includes('开放申购') && state.includes('开放赎回')) return '开放申赎'
  if (state.includes('开放申购')) return '开放申购'
  if (state.includes('开放赎回')) return '开放赎回'

  const limitMatch = state.match(/上限(\d+(?:\.\d+)?)(万?元)/)
  if (limitMatch) {
    const [, amount, unit] = limitMatch
    const normalized = amount.endsWith('.00') ? amount.slice(0, -3) : amount
    return `限额${normalized}${unit}`
  }

  if (state.includes('限大额') || state.includes('限额') || state.includes('限购')) return '限额开放'
  return state
}

function statusLabel(item: SaveFundItem) {
  if (item.market_type === 'bond') return '可关注'
  if (isPaused(item)) return '暂停申购'
  return compactFundState(item.fund_state)
}

function statusClass(item: SaveFundItem) {
  if (item.market_type === 'bond') return 'status-bond'
  if (isPaused(item)) return 'status-paused'
  if (isLimited(item)) return 'status-limited'
  return 'status-open'
}

function amountLabel(item: SaveFundItem) {
  if (item.market_type === 'bond') return `双低参考 ${item.market_price_display || '--'}`
  return `成交额 ${item.market_change_display || '--'}`
}

function trendText(item: SaveFundItem) {
  if (item.market_type === 'bond') return `转股价值 ${item.nav_price_display || '--'}`
  if (lofStore.homeCategory === 'etf' || item.market_type === 'etf') return `IOPV ${item.nav_price_display || '--'}`
  return `净值 ${item.nav_price_display || '--'} · 现价 ${item.market_price_display || '--'}`
}

function decisionHint(item: SaveFundItem) {
  if (item.market_type === 'bond') return '先看双低变化，再看强赎节奏'
  if (lofStore.homeCategory === 'etf' || item.market_type === 'etf') return '先看 IOPV 偏离，再看申赎状态'
  if (item.down_days > 0) return '先看净值回归，再看连跌是否延续'
  return '先看净值偏离，再看成交与申赎状态'
}

function detailActionLabel() {
  return lofStore.homeCategory === 'bond' ? '风险策略' : '走势'
}

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

async function loadHome() {
  try {
    home.value = await fetchSaveHome(lofStore.homeCategory, deviceId)
  } catch {
    home.value = null
  }
}

async function refreshPage(resetList = true) {
  await Promise.all([loadHome(), loadList(resetList)])
}

function handleRefresh() {
  void refreshPage()
}

function changeTab(key: CategoryKey) {
  if (lofStore.homeCategory === key) return
  lofStore.setHomeCategory(key)
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
    items.value = [...items.value]
    lofStore.toggleFavorite(item.code)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '更新自选失败'
  }
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

watch(() => lofStore.homeCategory, () => {
  quickFilter.value = 'all'
  statusFilter.value = 'all'
  sortKey.value = 'premium-desc'
  items.value = []
  response.value = null
  home.value = null
  void refreshPage()
})

onMounted(() => {
  void refreshPage()
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar-copy">
        <span class="kicker">{{ lofStore.homeCategory === 'etf' ? '盘中偏离监控' : '实时套利监控' }}</span>
        <h1>{{ currentTabMeta.label }}</h1>
        <p>{{ heroLoading ? '数据加载中，请稍候' : syncMessage }}</p>
      </div>
      <div class="topbar-actions">
        <button class="text-btn compact" @click="filterSheetOpen = true">筛选</button>
        <button class="icon-btn" aria-label="刷新" @click="handleRefresh">↻</button>
      </div>
    </header>

    <section class="hero-strip">
      <div v-if="heroLoading" class="hero-metrics">
        <article v-for="item in 4" :key="item" class="metric-box skeleton-metric">
          <span class="skeleton-line short"></span>
          <strong class="skeleton-line value"></strong>
        </article>
      </div>
      <div v-else class="hero-metrics">
        <article class="metric-box">
          <span>更新时间</span>
          <strong>{{ updateTime }}</strong>
        </article>
        <article class="metric-box">
          <span>监测标的</span>
          <strong>{{ summary.currentCount }}</strong>
        </article>
        <article class="metric-box accent">
          <span>高溢价</span>
          <strong>{{ summary.premiumCount }}</strong>
        </article>
        <article class="metric-box success">
          <span>可关注</span>
          <strong>{{ summary.opportunityCount }}</strong>
        </article>
      </div>
      <div class="hero-tags">
        <span class="badge">{{ lofStore.homeCategory === 'etf' ? 'IOPV 锚定' : '净值锚定' }}</span>
        <span class="badge badge-hot">{{ activeSortLabel }}</span>
      </div>
    </section>

    <nav class="market-tabs">
      <button
        v-for="item in categoryTabs"
        :key="item.key"
        :class="['market-tab', { active: lofStore.homeCategory === item.key }]"
        @click="changeTab(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <section class="chip-row">
      <button
        v-for="item in quickFilters"
        :key="item.key"
        :class="['chip', { active: quickFilter === item.key }]"
        @click="quickFilter = item.key"
      >
        {{ item.label }}
      </button>
      <button class="chip more-chip" @click="filterSheetOpen = true">更多</button>
    </section>

    <section v-if="response?.special_notes?.length" class="news-ticker">
      <strong>汇市快报</strong>
      <p>{{ response.special_notes[0] }}</p>
    </section>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="skeleton-stack">
      <div class="skeleton-card large"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>
    <section v-else-if="filteredItems.length === 0" class="state-card">当前没有匹配的标的</section>

    <section v-else class="list-stack">
      <article
        v-for="item in filteredItems"
        :key="item.code"
        class="fund-card"
        @click="openDetail(item)"
      >
        <div class="fund-head compact-head">
          <div class="fund-title-wrap">
            <button
              class="star-btn"
              :class="{ active: item.starred }"
              :aria-label="item.starred ? '取消收藏' : '加入收藏'"
              @click.stop="toggleFavorite(item)"
            >
              ★
            </button>
            <div class="fund-title">
              <h3>{{ item.name }}</h3>
              <p>{{ item.code }}</p>
            </div>
          </div>
          <div class="hero-metrics-side">
            <div class="metric-main-block">
              <span class="premium-caption">溢价率</span>
              <strong :class="premiumClass(item)">{{ premiumText(item) }}</strong>
            </div>
            <div class="metric-main-block secondary">
              <span class="premium-caption">场内价格</span>
              <div class="price-line">
                <strong class="price-value-main">{{ item.market_price_display || '--' }}</strong>
                <em :class="['price-change', item.up ? 'is-premium' : 'is-discount']">{{ item.market_change_display || '--' }}</em>
              </div>
            </div>
          </div>
        </div>

        <div class="status-row">
          <span :class="['status-pill', statusClass(item)]">{{ statusLabel(item) }}</span>
          <span class="inline-note">{{ item.down_days > 0 ? `连跌 ${item.down_days}/${item.max_down_days}` : '跟踪中' }}</span>
        </div>

        <div class="premium-panel compact-panel">
          <div class="premium-copy mini">
            <span>{{ lofStore.homeCategory === 'etf' || item.market_type === 'etf' ? 'IOPV 锚点' : '净值锚点' }}</span>
            <strong class="anchor-text">{{ item.nav_price_display || '--' }}</strong>
          </div>
          <div class="premium-bar">
            <div :class="['premium-fill', premiumClass(item)]" :style="{ width: premiumBarWidth(item) }"></div>
          </div>
        </div>

        <div class="metric-grid compact-grid">
          <div class="metric-chip primary">
            <span>成交额</span>
            <strong>{{ item.amount_display || '--' }}</strong>
          </div>
          <div class="metric-chip">
            <span>场内涨跌</span>
            <strong :class="marketChangeClass(item)">{{ item.market_change_display || '--' }}</strong>
          </div>
          <div class="metric-chip">
            <span>{{ item.market_type === 'etf' ? '观察点' : '节奏' }}</span>
            <strong>{{ item.down_days > 0 ? `连跌 ${item.down_days} 天` : '盘中观察' }}</strong>
          </div>
          <div class="metric-chip muted">
            <span>代码</span>
            <strong>{{ item.code }}</strong>
          </div>
        </div>

        <div class="metric-lines compact-lines">
          <div class="metric-line single">
            <span class="metric-note">{{ decisionHint(item) }}</span>
            <span>{{ item.market_type === 'etf' ? '盘中关注 IOPV 偏离' : '盘中关注净值回归' }}</span>
          </div>
        </div>

        <div class="action-row compact-actions">
          <button class="ghost-btn primary-ghost" @click.stop="openDetail(item)">查看判断</button>
          <button class="ghost-btn subtle" @click.stop="router.push('/watchlist')">加提醒</button>
        </div>
      </article>
    </section>

    <div ref="loadMoreRef" class="load-more">
      <p v-if="loadingMore">加载更多中...</p>
      <p v-else-if="hasMore">继续上滑加载更多</p>
      <p v-else>已经到底了</p>
    </div>

    <footer class="disclaimer-bar">
      ⚠️ 数据仅供参考，不构成投资建议
    </footer>

    <div v-if="filterSheetOpen" class="sheet-mask" @click="filterSheetOpen = false"></div>
    <section v-if="filterSheetOpen" class="filter-sheet">
      <div class="sheet-head">
        <h3>更多筛选</h3>
        <button class="sheet-close" @click="filterSheetOpen = false">×</button>
      </div>

      <div class="sheet-group">
        <span class="sheet-title">状态</span>
        <div class="sheet-chips">
          <button
            v-for="item in statusOptions"
            :key="item.key"
            :class="['sheet-chip', { active: statusFilter === item.key }]"
            @click="statusFilter = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="sheet-group">
        <span class="sheet-title">排序</span>
        <div class="sheet-chips">
          <button
            v-for="item in sortOptions"
            :key="item.key"
            :class="['sheet-chip', { active: sortKey === item.key }]"
            @click="sortKey = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="sheet-actions">
        <button
          class="sheet-btn secondary"
          @click="
            quickFilter = 'all';
            statusFilter = 'all';
            sortKey = 'premium-desc'
          "
        >
          重置
        </button>
        <button class="sheet-btn primary" @click="filterSheetOpen = false">应用筛选</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(10px + env(safe-area-inset-top)) 12px calc(118px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, rgba(74, 144, 226, 0.18), transparent 32%),
    radial-gradient(circle at 0% 18%, rgba(41, 179, 126, 0.10), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 18%),
    #1a1e2b;
  color: var(--lof-text);
  animation: page-fade-in 220ms ease-out;
}

.topbar,
.fund-head,
.metric-line,
.action-row,
.sheet-head,
.sheet-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.topbar h1 {
  margin-top: 6px;
  font-size: 26px;
  line-height: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.topbar p,
.fund-title p,
.metric-line span,
.load-more p {
  color: var(--lof-muted);
  font-size: 11px;
  line-height: 15px;
}

.fund-title p {
  margin-top: 2px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-copy {
  flex: 1;
  min-width: 0;
}

.kicker {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(74, 144, 226, 0.10);
  color: #c8ddff;
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.icon-btn,
.text-btn,
.market-tab,
.chip,
.more-chip,
.star-btn,
.ghost-btn,
.sheet-close,
.sheet-chip,
.sheet-btn {
  cursor: pointer;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(234, 236, 240, 0.12);
  border-radius: 12px;
  background: rgba(36, 43, 61, 0.88);
  color: var(--lof-text);
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.text-btn.compact {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 12px;
  background: rgba(36, 43, 61, 0.88);
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.hero-strip,
.news-ticker,
.state-card,
.fund-card,
.filter-sheet {
  margin-top: 8px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 16px;
  background: rgba(36, 43, 61, 0.94);
  box-shadow: var(--lof-shadow);
}

.hero-strip,
.news-ticker,
.state-card,
.fund-card,
.filter-sheet {
  padding: 11px;
}

.hero-strip {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background:
    linear-gradient(180deg, rgba(74, 144, 226, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(36, 43, 61, 0.96);
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.metric-box {
  padding: 8px 8px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(234, 236, 240, 0.05);
  backdrop-filter: blur(6px);
}

.metric-box span {
  display: block;
  color: var(--lof-muted);
  font-size: 10px;
  line-height: 14px;
}

.metric-box strong {
  display: block;
  margin-top: 4px;
  color: var(--lof-text);
  font-family: 'Roboto Mono', 'Menlo', monospace;
  font-size: 13px;
  line-height: 16px;
  font-weight: 700;
}

.metric-box.accent strong {
  color: var(--lof-danger);
}

.metric-box.success strong {
  color: var(--lof-success);
}

.skeleton-metric {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.skeleton-line {
  display: block;
  border-radius: 999px;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 38%, rgba(255,255,255,0.04) 52%);
  background-size: 220% 100%;
  animation: pulse-shimmer 1.4s linear infinite;
}

.skeleton-line.short {
  width: 54%;
  height: 10px;
}

.skeleton-line.value {
  width: 72%;
  height: 16px;
  margin-top: 8px;
}

.hero-tags {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
}

.text-btn {
  border: 0;
  background: none;
  color: var(--lof-link);
  font-size: 13px;
  font-weight: 600;
}

.badge,
.status-pill,
.sheet-chip,
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 27px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
}

.status-pill {
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 0 0 auto;
  font-weight: 700;
}

.badge {
  background: rgba(74, 144, 226, 0.14);
  color: var(--lof-link);
  box-shadow: inset 0 0 0 1px rgba(74, 144, 226, 0.08);
}

.badge-hot {
  background: rgba(255, 140, 0, 0.14);
  color: var(--lof-warning);
  box-shadow: inset 0 0 0 1px rgba(255, 140, 0, 0.08);
}

.market-tabs,
.chip-row,
.sheet-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.market-tabs::-webkit-scrollbar,
.chip-row::-webkit-scrollbar,
.sheet-chips::-webkit-scrollbar {
  display: none;
}

.market-tabs {
  margin-top: 10px;
}

.market-tab,
.chip,
.more-chip,
.sheet-chip {
  border: 1px solid rgba(234, 236, 240, 0.1);
  background: rgba(36, 43, 61, 0.8);
  color: var(--lof-muted);
  white-space: nowrap;
}

.market-tab {
  min-width: 86px;
  min-height: 40px;
  border-radius: 12px;
  font-size: 12px;
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}

.market-tab.active,
.chip.active,
.sheet-chip.active {
  border-color: rgba(74, 144, 226, 0.36);
  background: rgba(74, 144, 226, 0.18);
  color: var(--lof-text);
}

.chip-row {
  margin-top: 8px;
}

.more-chip {
  color: var(--lof-warning);
}

.market-tab:hover,
.chip:hover,
.more-chip:hover,
.sheet-chip:hover,
.text-btn.compact:hover,
.icon-btn:hover {
  transform: translateY(-1px);
}

.news-ticker strong {
  display: block;
  color: var(--lof-warning);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
}

.news-ticker p {
  margin-top: 3px;
  color: var(--lof-text);
  font-size: 11px;
  line-height: 16px;
}

.state-card {
  color: var(--lof-muted);
  text-align: center;
}

.skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.skeleton-card {
  height: 152px;
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.03) 52%),
    rgba(36, 43, 61, 0.96);
  background-size: 220% 100%;
  animation: pulse-shimmer 1.4s linear infinite;
  border: 1px solid rgba(234, 236, 240, 0.06);
}

.skeleton-card.large {
  height: 168px;
}

.list-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.fund-card {
  cursor: pointer;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02)),
    rgba(36, 43, 61, 0.96);
  border-radius: 18px;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.fund-title {
  flex: 1;
  min-width: 0;
}

.fund-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.fund-title h3 {
  font-size: 14px;
  line-height: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.compact-head {
  align-items: flex-start;
}

.hero-metrics-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex: 0 0 auto;
}

.metric-main-block {
  text-align: right;
}

.metric-main-block.secondary {
  opacity: 0.96;
}

.premium-caption {
  display: block;
  color: var(--lof-muted);
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0.02em;
}

.metric-main-block strong {
  display: block;
  margin-top: 2px;
  font-family: 'Roboto Mono', 'Menlo', monospace;
  font-size: 18px;
  line-height: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.price-line {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 2px;
}

.price-value-main {
  color: var(--lof-text);
}

.price-change {
  font-style: normal;
  font-family: 'Roboto Mono', 'Menlo', monospace;
  font-size: 11px;
  line-height: 14px;
  font-weight: 700;
  opacity: 0.92;
}

.star-btn {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: #7f899f;
}

.star-btn.active {
  color: #ffcf5b;
  border-color: rgba(255, 207, 91, 0.26);
  background: rgba(255, 207, 91, 0.12);
}

.status-open {
  background: rgba(0, 200, 83, 0.14);
  color: var(--lof-success);
}

.status-limited {
  background: rgba(255, 140, 0, 0.16);
  color: var(--lof-warning);
}

.status-paused {
  background: rgba(97, 106, 122, 0.22);
  color: #c5cad6;
}

.status-bond {
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
}

.premium-panel {
  margin-top: 10px;
}

.compact-panel {
  margin-top: 7px;
}

.premium-copy {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.premium-copy span {
  color: var(--lof-muted);
  font-size: 11px;
  line-height: 16px;
}

.premium-copy.mini {
  gap: 10px;
}

.anchor-text {
  color: var(--lof-text) !important;
  font-family: 'Roboto Mono', 'Menlo', monospace;
  font-size: 11px !important;
  line-height: 16px !important;
  font-weight: 700 !important;
}

.premium-copy strong {
  font-family: 'Roboto Mono', 'Menlo', monospace;
  font-size: 24px;
  line-height: 28px;
  font-weight: 700;
}

.is-premium {
  color: var(--lof-danger);
}

.is-discount {
  color: var(--lof-success);
}

.premium-bar {
  height: 8px;
  margin-top: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.premium-fill {
  height: 100%;
  border-radius: inherit;
}

.premium-fill.is-premium {
  background: linear-gradient(90deg, rgba(255, 77, 79, 0.42), #ff4d4f);
}

.premium-fill.is-discount {
  background: linear-gradient(90deg, rgba(41, 179, 126, 0.42), #29b37e);
}

.metric-lines {
  margin-top: 10px;
}

.metric-lines .metric-line + .metric-line {
  margin-top: 6px;
}

.compact-lines {
  margin-top: 7px;
}

.metric-line.single {
  padding-top: 1px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
}

.inline-note {
  color: var(--lof-muted);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  text-align: right;
}

.metric-grid.compact-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.metric-chip {
  padding: 7px 7px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(234, 236, 240, 0.04);
  min-width: 0;
}

.metric-chip span {
  display: block;
  color: var(--lof-muted);
  font-size: 10px;
  line-height: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-chip strong {
  display: block;
  margin-top: 4px;
  color: var(--lof-text);
  font-size: 11px;
  line-height: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-chip.primary {
  background: rgba(74, 144, 226, 0.08);
  border-color: rgba(74, 144, 226, 0.08);
}

.metric-chip.primary strong {
  color: #dbe9ff;
}

.metric-chip.muted strong {
  color: #aab5c8;
  font-family: 'Roboto Mono', 'Menlo', monospace;
}

.metric-note {
  color: #b8c6db !important;
  font-weight: 600;
}

.action-row {
  margin-top: 8px;
}

.compact-actions {
  margin-top: 7px;
}

.ghost-btn {
  flex: 1;
  min-height: 38px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--lof-text);
  font-size: 12px;
  font-weight: 700;
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}

.ghost-btn.primary-ghost {
  background: rgba(74, 144, 226, 0.14);
  border-color: rgba(74, 144, 226, 0.18);
  color: #d8e8ff;
}

.ghost-btn.subtle {
  color: var(--lof-muted);
}

.fund-card:hover {
  transform: translateY(-2px);
  border-color: rgba(74, 144, 226, 0.18);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.24);
}

.ghost-btn:hover {
  transform: translateY(-1px);
}

.load-more {
  padding: 12px 0 0;
  text-align: center;
}

.disclaimer-bar {
  position: fixed;
  left: 50%;
  bottom: calc(64px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: min(430px, calc(100vw - 32px));
  height: 40px;
  border-top: 1px solid rgba(234, 236, 240, 0.08);
  background: #161a23;
  color: #bcc6d6;
  font-size: 12px;
  line-height: 40px;
  text-align: center;
  z-index: 20;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  z-index: 29;
}

.filter-sheet {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, 100vw);
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  z-index: 30;
}

.sheet-head h3,
.sheet-title {
  color: var(--lof-text);
}

.sheet-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: var(--lof-text);
  font-size: 20px;
}

.sheet-group {
  margin-top: 16px;
}

.sheet-title {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
}

.sheet-actions {
  margin-top: 20px;
}

.sheet-btn {
  flex: 1;
  min-height: 44px;
  border-radius: 12px;
}

.sheet-btn.secondary {
  border: 1px solid rgba(234, 236, 240, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--lof-text);
}

.sheet-btn.primary {
  border: 0;
  background: var(--lof-link);
  color: #fff;
}

@keyframes pulse-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@keyframes page-fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 380px) {
  .page {
    padding-left: 12px;
    padding-right: 12px;
  }

  .topbar,
  .fund-head,
  .status-row,
  .metric-line,
  .action-row,
  .sheet-head,
  .sheet-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .action-row .ghost-btn,
  .sheet-btn {
    width: 100%;
  }

  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-grid.compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-tags {
    justify-content: flex-start;
  }

  .inline-note {
    white-space: normal;
  }

  .disclaimer-bar {
    width: calc(100vw - 24px);
  }
}
</style>
