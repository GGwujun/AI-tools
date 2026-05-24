<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchBondDetail, updateFavorite, type BondDetailResponse } from '@/lib/save-api'
import { useLofH5Store } from '@/stores/lofH5'

type BondTabKey = 'core' | 'risk' | 'strategy' | 'stock'

const route = useRoute()
const router = useRouter()
const lofStore = useLofH5Store()
const deviceId = getDeviceId()

const loading = ref(false)
const error = ref('')
const detail = ref<BondDetailResponse | null>(null)
const currentTab = ref<BondTabKey>('core')

const tabs: Array<{ key: BondTabKey; label: string; routeName?: string }> = [
  { key: 'core', label: '当前结论', routeName: 'bond-detail-core' },
  { key: 'risk', label: '强赎风险', routeName: 'bond-detail-risk' },
  { key: 'strategy', label: '策略参考' },
  { key: 'stock', label: '正股联动' },
]

const favoriteActive = computed(() => !!detail.value && lofStore.favoriteSet.has(detail.value.bond.code))
const riskTitle = computed(() => {
  if (!detail.value) return '当前未见强赎压力'
  const redeemStatus = detail.value.bond.redeem_status || ''
  if (redeemStatus.includes('预警')) return '当前接近强赎预警'
  if (redeemStatus.includes('公告')) return '当前已公告强赎，请重点关注时间节点'
  return '当前未见强赎压力'
})

const metricRows = computed(() => {
  if (!detail.value) return []
  return [
    ['转债价格', detail.value.bond.price],
    ['转股价值', detail.value.bond.convert_value],
    ['转股溢价率', detail.value.bond.premium_rate],
    ['双低值', detail.value.bond.dual_low],
    ['纯债价值', detail.value.bond.pure_bond_value],
    ['到期收益', detail.value.bond.maturity_yield],
    ['剩余规模', detail.value.bond.scale],
    ['剩余年限', detail.value.bond.remain_years],
    ['强赎状态', detail.value.bond.redeem_status],
  ]
})

function initTab() {
  currentTab.value = route.name === 'bond-detail-risk' ? 'risk' : 'core'
}

async function loadDetail() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await fetchBondDetail(String(route.query.code || '123456'))
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function switchTab(tab: { key: BondTabKey; routeName?: string }) {
  currentTab.value = tab.key
  if (tab.routeName) {
    router.replace({ name: tab.routeName, query: route.query })
  }
}

async function toggleFavorite() {
  if (!detail.value) return
  const starred = !favoriteActive.value
  try {
    await updateFavorite(detail.value.bond.code, 'bond', deviceId, starred)
    lofStore.toggleFavorite(detail.value.bond.code)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '更新自选失败'
  }
}

function toggleReminder(type: 'redeem' | 'abnormal') {
  if (!detail.value) return
  lofStore.toggleReminder(`${detail.value.bond.code}:${type}`)
}

watch(() => route.query.code, () => void loadDetail())
watch(() => route.name, initTab)

onMounted(() => {
  initTab()
  void loadDetail()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="nav-btn" aria-label="返回" @click="router.back()">‹</button>
      <div class="title-block">
        <h1>转债详情</h1>
        <p>本页内容仅供参考，不构成投资建议</p>
      </div>
      <button class="ghost-btn" @click="toggleFavorite">{{ favoriteActive ? '已自选' : '自选' }}</button>
    </header>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="state-card">正在加载转债详情...</section>

    <template v-else-if="detail">
      <section class="hero-card">
        <div class="hero-head">
          <div>
            <h2>{{ detail.bond.name }}</h2>
            <p>{{ detail.bond.code }} · 正股 {{ detail.bond.stock_name }}</p>
          </div>
          <div class="hero-price">
            <span>双低值</span>
            <strong>{{ detail.bond.dual_low }}</strong>
          </div>
        </div>
        <div class="tag-row">
          <span v-for="tag in detail.bond.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <div class="hero-actions">
          <button class="primary-btn" @click="toggleFavorite">{{ favoriteActive ? '已加入自选' : '加入自选' }}</button>
          <button class="secondary-btn" @click="toggleReminder('redeem')">开启强赎提醒</button>
        </div>
      </section>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-btn', { active: currentTab === tab.key }]"
          @click="switchTab(tab)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <template v-if="currentTab === 'core'">
        <section class="panel">
          <div class="panel-head">
            <h3>当前结论</h3>
            <span class="panel-note">条件化参考</span>
          </div>
          <div class="conclusion-card">
            <strong>{{ detail.conclusion.title }}</strong>
            <p>{{ detail.conclusion.summary }}</p>
            <p>{{ detail.conclusion.risk }}</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>实时数据</h3>
          </div>
          <div class="data-grid">
            <div v-for="row in metricRows" :key="row[0]" class="data-card">
              <span>{{ row[0] }}</span>
              <strong>{{ row[1] }}</strong>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="currentTab === 'risk'">
        <section class="panel risk-panel">
          <div class="panel-head">
            <h3>强赎风险</h3>
          </div>
          <div class="conclusion-card risk-banner">
            <strong>{{ riskTitle }}</strong>
            <p>最后交易日：{{ detail.bond.last_trade_date }}</p>
            <p>最后转股日：{{ detail.bond.last_convert_date }}</p>
          </div>
          <div class="info-list">
            <div v-for="item in detail.risk_items" :key="item.label" class="info-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="currentTab === 'strategy'">
        <section class="strategy-stack">
          <article v-for="item in detail.strategy_cards" :key="item.title" class="strategy-card">
            <div class="strategy-head">
              <h3>{{ item.title }}</h3>
              <span class="strategy-tag">仅供参考</span>
            </div>
            <p>{{ item.summary }}</p>
            <div class="strategy-grid">
              <div>
                <span>仓位参考</span>
                <strong>{{ item.position }}</strong>
              </div>
              <div>
                <span>退出参考</span>
                <strong>{{ item.exit }}</strong>
              </div>
              <div class="span-2">
                <span>风险提示</span>
                <strong>{{ item.risk }}</strong>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-else>
        <section class="panel">
          <div class="panel-head">
            <h3>正股联动</h3>
            <span class="panel-note">结合正股波动一起观察</span>
          </div>
          <div class="data-grid">
            <div class="data-card">
              <span>正股名称</span>
              <strong>{{ detail.bond.stock_name }}</strong>
            </div>
            <div class="data-card">
              <span>波动标签</span>
              <strong>高弹性</strong>
            </div>
            <div class="data-card">
              <span>观察重点</span>
              <strong>双低与强赎时间节点</strong>
            </div>
            <div class="data-card span-2">
              <span>AI 解读</span>
              <strong class="regular">正股波动较强时，转债弹性和强赎节奏都需要同步跟踪，仅供参考。</strong>
            </div>
          </div>
        </section>
      </template>
    </template>

    <footer class="bottom-bar">
      <button class="secondary-btn" @click="toggleFavorite">{{ favoriteActive ? '已加入自选' : '加入自选' }}</button>
      <button class="secondary-btn" @click="toggleReminder('abnormal')">开启异动提醒</button>
      <button class="primary-btn" @click="switchTab(tabs.find((item) => item.key === 'risk') || tabs[0])">查看强赎风险</button>
    </footer>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) 16px calc(92px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top left, rgba(240, 138, 36, 0.1), transparent 28%),
    #f5f7fb;
}
.topbar,
.hero-head,
.hero-actions,
.panel-head,
.strategy-head,
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.topbar {
  align-items: flex-start;
}
.nav-btn,
.ghost-btn,
.tab-btn,
.primary-btn,
.secondary-btn {
  border: 0;
  font: inherit;
  cursor: pointer;
}
.nav-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #d9e0e8;
  color: #1f2937;
  font-size: 24px;
}
.ghost-btn {
  min-width: 64px;
  height: 38px;
  padding: 0 12px;
  border-radius: 12px;
  background: #fff4e6;
  color: #c97a10;
  font-size: 12px;
  font-weight: 700;
}
.title-block {
  flex: 1;
}
.title-block h1 {
  color: #1f2937;
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
}
.title-block p,
.panel-note,
.conclusion-card p,
.strategy-card p,
.info-row span {
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}
.hero-card,
.panel,
.state-card,
.strategy-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e8edf3;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}
.state-card {
  text-align: center;
}
.hero-card h2,
.panel h3,
.strategy-card h3 {
  color: #1f2937;
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
}
.hero-price {
  text-align: right;
}
.hero-price span,
.tag,
.data-card span,
.strategy-grid span {
  display: block;
  font-size: 11px;
  line-height: 16px;
}
.hero-price strong {
  display: block;
  margin-top: 4px;
  color: #c97a10;
  font-size: 24px;
  line-height: 28px;
  font-weight: 700;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #fff4e6;
  color: #c97a10;
  font-weight: 600;
}
.hero-actions {
  margin-top: 14px;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.tab-btn {
  min-height: 40px;
  padding: 0 8px;
  border-radius: 12px;
  border: 1px solid #d9e0e8;
  background: rgba(255, 255, 255, 0.84);
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}
.tab-btn.active {
  border-color: #f0d7b5;
  background: #fff4e6;
  color: #c97a10;
}
.conclusion-card {
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafd;
}
.conclusion-card strong {
  display: block;
  color: #1f2937;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.conclusion-card p + p {
  margin-top: 6px;
}
.risk-banner {
  background: #fff6f7;
}
.data-grid,
.strategy-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.data-card {
  padding: 14px;
  border-radius: 14px;
  background: #f8fafd;
}
.data-card strong,
.strategy-grid strong,
.info-row strong {
  display: block;
  margin-top: 4px;
  color: #1f2937;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.regular {
  font-size: 14px !important;
  line-height: 22px !important;
  font-weight: 600 !important;
}
.info-list {
  margin-top: 12px;
}
.info-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f5;
}
.info-row:last-child {
  border-bottom: 0;
}
.strategy-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.strategy-tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #fff4e6;
  color: #c97a10;
  font-size: 11px;
  font-weight: 700;
}
.strategy-card p {
  margin-top: 10px;
}
.span-2 {
  grid-column: span 2;
}
.primary-btn,
.secondary-btn {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
}
.primary-btn {
  background: #127c74;
  color: #fff;
}
.secondary-btn {
  background: #fff;
  border: 1px solid #d9e0e8;
  color: #1f2937;
}
.bottom-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, calc(100vw - 20px));
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  background: rgba(245, 247, 251, 0.94);
  backdrop-filter: blur(12px);
}
@media (max-width: 380px) {
  .tabs,
  .data-grid,
  .strategy-grid,
  .bottom-bar {
    grid-template-columns: 1fr;
  }
  .topbar,
  .hero-head,
  .hero-actions {
    flex-direction: column;
    align-items: flex-start;
  }
  .span-2 {
    grid-column: span 1;
  }
  .bottom-bar {
    display: grid;
    width: min(430px, calc(100vw - 24px));
  }
}
</style>
