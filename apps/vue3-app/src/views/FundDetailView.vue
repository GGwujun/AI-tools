<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchSaveFundDetail, updateFavorite, type SaveFundDetailResponse } from '@/lib/save-api'
import { getDeviceId } from '@/lib/device'
import { useLofH5Store } from '@/stores/lofH5'

type FundTabKey = 'core' | 'realtime' | 'history' | 'strategy'

const route = useRoute()
const router = useRouter()
const lofStore = useLofH5Store()
const deviceId = getDeviceId()

const loading = ref(false)
const error = ref('')
const detail = ref<SaveFundDetailResponse | null>(null)
const currentTab = ref<FundTabKey>('core')

const tabs: Array<{ key: FundTabKey; label: string; routeName: string }> = [
  { key: 'core', label: '当前结论', routeName: 'fund-detail-core' },
  { key: 'realtime', label: '实时数据', routeName: 'fund-detail-realtime' },
  { key: 'history', label: '历史记录', routeName: 'fund-detail-history' },
  { key: 'strategy', label: '策略参考', routeName: 'fund-detail-strategy' },
]

const fund = computed(() => detail.value?.fund ?? null)
const favoriteActive = computed(() => !!fund.value && lofStore.favoriteSet.has(fund.value.code))
const reminderArrivalKey = computed(() => (fund.value ? `${fund.value.code}:arrival` : ''))
const reminderSellKey = computed(() => (fund.value ? `${fund.value.code}:sell` : ''))
const reminderArrivalActive = computed(() => !!reminderArrivalKey.value && lofStore.reminderSet.has(reminderArrivalKey.value))
const reminderSellActive = computed(() => !!reminderSellKey.value && lofStore.reminderSet.has(reminderSellKey.value))

const tags = computed(() => {
  if (!fund.value) return []
  return [
    tagForCategory(fund.value.market_type),
    statusLabel(fund.value),
    riskLabel(),
  ]
})

const conclusionTitle = computed(() => {
  if (!fund.value) return '当前更适合继续观察'
  if (fund.value.paused) return '当前不建议继续跟踪申购节奏'
  if ((fund.value.premium_rate ?? 0) >= 1) return '当前处在可重点观察的套利区间'
  if ((fund.value.premium_rate ?? 0) >= 0.3) return '当前有观察价值，但不宜过早下判断'
  return '当前更适合耐心跟踪盘中回归节奏'
})

const conclusionSummary = computed(() => {
  if (!detail.value || !fund.value) return []
  return [
    `当前溢价率为 ${fund.value.premium_display}，先结合净值锚点看偏离是否继续扩大。`,
    `历史样本参考：${detail.value.historical_stats.success_rate || '--'} 成功率，适合作为辅助判断。`,
    `当前更需要盯住：${detail.value.risk.risk_tags.join('、') || '估值误差与流动性变化'}`,
  ]
})

const keyJudgementCards = computed(() => {
  if (!detail.value || !fund.value) return []
  const valuationAnchor = fund.value.market_type?.toLowerCase() === 'etf' ? 'IOPV' : '估算净值'
  return [
    { label: '场内价格', value: fund.value.market_price_display || '--', accent: 'normal' },
    { label: valuationAnchor, value: fund.value.nav_price_display || '--', accent: 'normal' },
    { label: '申赎状态', value: compactStateLabel(fund.value.fund_state), accent: 'normal' },
    { label: '风险重点', value: primaryRiskText(), accent: 'warning' },
  ]
})

const statCards = computed(() => {
  const stats = detail.value?.historical_stats
  if (!stats) return []
  return [
    { label: '总成功率', value: stats.success_rate || '--', accent: 'danger' },
    { label: '总收益率', value: stats.avg_return_rate || '--', accent: 'warning' },
    { label: '出现次数', value: String(stats.trigger_count || 0), accent: 'normal' },
    { label: '出现概率', value: stats.occurrence_probability || '--', accent: 'normal' },
  ]
})

const realtimeRows = computed(() => {
  if (!detail.value || !fund.value) return []
  const rows: Array<[string, string]> = [
    ['场内价格', fund.value.market_price_display || '--'],
    [fund.value.market_type?.toLowerCase() === 'etf' ? 'IOPV' : '估算净值', fund.value.nav_price_display || '--'],
    ['溢价率', fund.value.premium_display || '--'],
    ['申赎状态', compactStateLabel(fund.value.fund_state)],
    ['估值可靠度', qualityLabel(detail.value.quality.confidence_level)],
    ['风险提示', primaryRiskText()],
  ]

  if (detail.value.scale && detail.value.scale !== '--' && detail.value.scale !== '规模') {
    rows.push(['基金规模', detail.value.scale])
  }

  if (detail.value.turnover && detail.value.turnover !== '--') {
    rows.push(['成交额', detail.value.turnover])
  }

  return rows
})

const stepRows = computed(() => {
  if (!fund.value) return []
  return [
    ['申购时间', fund.value.paused ? '当前暂停申购' : '今日可申购'],
    ['确认时间', '预计 T+1 确认'],
    ['到账时间', '预计 T+2 到账'],
    ['可卖时间', '预计 T+2 / T+3 可卖'],
    ['重点关注', '持续跟踪限额、误差率与流动性变化'],
  ]
})

const historyRows = computed(() => detail.value?.nav_history ?? [])
const strategyCards = computed(() => detail.value?.arbitrage_strategies ?? [])
const riskItems = computed(() => detail.value?.risk.risk_tags ?? [])

function tagForCategory(marketType: string) {
  const normalized = marketType.toLowerCase()
  if (normalized === 'index_lof') return '指数型LOF'
  if (normalized === 'etf') return '无时差ETF'
  return '股债型LOF'
}

function statusLabel(item: NonNullable<typeof fund.value>) {
  if (item.paused || item.fund_state.includes('暂停')) return '暂停申购'
  if (item.fund_state.includes('限额')) return '限额开放'
  return '可申购'
}

function compactStateLabel(rawState: string) {
  const state = rawState.trim()
  if (!state) return '可申购'
  if (state.includes('场内交易')) return '场内交易'
  if (state.includes('开放申购') && state.includes('开放赎回')) return '开放申赎'
  if (state.includes('开放申购')) return '开放申购'
  if (state.includes('开放赎回')) return '开放赎回'
  if (state.includes('暂停申购')) return '暂停申购'
  if (state.includes('暂停赎回')) return '暂停赎回'
  if (state.includes('限额') || state.includes('限大额') || state.includes('限购')) return '限额开放'
  return state
}

function riskLabel() {
  if (!detail.value) return '中风险'
  const level = detail.value.risk.risk_level || ''
  if (level.includes('高')) return '高风险'
  if (level.includes('低')) return '低风险'
  return '中风险'
}

function riskClass(label: string) {
  if (label.includes('高')) return 'risk-high'
  if (label.includes('低')) return 'risk-low'
  return 'risk-mid'
}

function sourceLabel(source: string) {
  if (!source) return '--'
  if (source.includes('iopv')) return '实时 IOPV'
  if (source.includes('estimate')) return '盘中估算'
  if (source.includes('official')) return '官方净值'
  if (source.includes('heuristic')) return '规则估算'
  return source
}

function qualityLabel(level: string) {
  if (!level) return '一般'
  if (level.includes('HIGH')) return '较高'
  if (level.includes('LOW')) return '一般'
  if (level.includes('MID')) return '中等'
  return level
}

function primaryRiskText() {
  const first = detail.value?.risk.risk_tags?.[0]
  if (first) return first
  return '持续跟踪估值偏差'
}

const valuationRows = computed(() => {
  const valuation = detail.value?.valuation
  if (!valuation) return []
  return [
    ['官方净值来源', sourceLabel(valuation.official_nav_source)],
    ['估算净值来源', sourceLabel(valuation.estimate_nav_source)],
    ['IOPV 来源', sourceLabel(valuation.iopv_source)],
    ['估算净值', valuation.estimate_nav_value == null ? '--' : String(valuation.estimate_nav_value)],
    ['IOPV', valuation.iopv_nav_value == null ? '--' : String(valuation.iopv_nav_value)],
  ]
})

function initCurrentTab() {
  const name = String(route.name || '')
  if (name === 'fund-detail-realtime') currentTab.value = 'realtime'
  else if (name === 'fund-detail-history') currentTab.value = 'history'
  else if (name === 'fund-detail-strategy') currentTab.value = 'strategy'
  else currentTab.value = 'core'
}

async function loadDetail() {
  const code = String(route.query.code || '160629')
  const marketType = String(route.query.marketType || 'stock_lof')
  loading.value = true
  error.value = ''
  try {
    detail.value = await fetchSaveFundDetail(code, marketType, deviceId)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function switchTab(tab: { key: FundTabKey; routeName: string }) {
  currentTab.value = tab.key
  router.replace({ name: tab.routeName, query: route.query })
}

async function toggleFavorite() {
  if (!fund.value) return
  const starred = !favoriteActive.value
  try {
    await updateFavorite(fund.value.code, fund.value.market_type, deviceId, starred)
    lofStore.toggleFavorite(fund.value.code)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '更新自选失败'
  }
}

function toggleReminder(type: 'arrival' | 'sell') {
  if (!fund.value) return
  lofStore.toggleReminder(`${fund.value.code}:${type}`)
}

watch(() => route.query.code, () => void loadDetail())
watch(() => route.query.marketType, () => void loadDetail())
watch(() => route.name, initCurrentTab)

onMounted(() => {
  initCurrentTab()
  void loadDetail()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="nav-btn" aria-label="返回" @click="router.back()">‹</button>
      <div class="title-block">
        <h1>基金详情</h1>
        <p>本页内容仅供参考，不构成投资建议</p>
      </div>
      <button class="ghost-btn" @click="toggleFavorite">{{ favoriteActive ? '已自选' : '自选' }}</button>
    </header>

    <section v-if="error" class="state-card">{{ error }}</section>
    <section v-else-if="loading" class="detail-skeleton">
      <div class="skeleton-block hero"></div>
      <div class="skeleton-block tabs"></div>
      <div class="skeleton-block card"></div>
      <div class="skeleton-block card"></div>
    </section>

    <template v-else-if="detail && fund">
      <section class="hero-card">
        <div class="hero-head">
          <div>
            <h2>{{ fund.name }}</h2>
            <p>{{ fund.code }} · 更新时间 {{ detail.update_time || '--' }}</p>
          </div>
          <div class="hero-price">
            <span>当前溢价率</span>
            <strong :class="fund.up ? 'text-danger' : 'text-success'">{{ fund.premium_display }}</strong>
          </div>
        </div>

        <div class="tag-row">
          <span
            v-for="tag in tags"
            :key="tag"
            :class="['tag', tag.includes('风险') ? riskClass(tag) : 'tag-neutral']"
          >
            {{ tag }}
          </span>
        </div>

        <div class="hero-actions">
          <button class="primary-btn" @click="toggleFavorite">{{ favoriteActive ? '已加入自选' : '加入自选' }}</button>
          <button class="secondary-btn" @click="toggleReminder('arrival')">{{ reminderArrivalActive ? '已开启到账提醒' : '开启到账提醒' }}</button>
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
            <span class="panel-note">当前优先看这几项</span>
          </div>
          <div class="conclusion-card">
            <strong>{{ conclusionTitle }}</strong>
            <p v-for="item in conclusionSummary" :key="item">{{ item }}</p>
          </div>
          <div class="judgement-grid">
            <article
              v-for="item in keyJudgementCards"
              :key="item.label"
              :class="['data-card', 'is-judgement', item.accent]"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>实时判断</h3>
            <span class="panel-note">围绕交易决策压缩展示</span>
          </div>
          <div class="data-grid">
            <div v-for="row in realtimeRows" :key="row[0]" class="data-card">
              <span>{{ row[0] }}</span>
              <strong>{{ row[1] }}</strong>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>节奏参考</h3>
            <span class="panel-note">仅供参考</span>
          </div>
          <div class="timeline">
            <div v-for="(row, index) in stepRows" :key="row[0]" class="timeline-row">
              <span class="timeline-index">{{ index + 1 }}</span>
              <div>
                <strong>{{ row[0] }}</strong>
                <p>{{ row[1] }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>历史套利统计</h3>
            <span class="panel-note">{{ detail.historical_stats.start_date || '--' }}</span>
          </div>
          <div class="stat-grid">
            <article
              v-for="item in statCards"
              :key="item.label"
              :class="['stat-card', item.accent]"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
          <p class="foot-note">历史统计结果仅反映样本区间表现，不代表未来表现。</p>
        </section>

        <section class="panel risk-panel">
          <div class="panel-head">
            <h3>风险提示</h3>
          </div>
          <ul class="risk-list">
            <li v-for="item in riskItems" :key="item">{{ item }}</li>
            <li v-if="riskItems.length === 0">净值估算、限额变化与流动性波动都需要持续跟踪。</li>
          </ul>
        </section>
      </template>

      <template v-else-if="currentTab === 'realtime'">
        <section class="panel">
          <div class="panel-head">
            <h3>实时数据</h3>
            <span class="panel-note">{{ detail.five_level.update_time || detail.update_time || '--' }}</span>
          </div>
          <div class="data-grid">
            <div v-for="row in realtimeRows" :key="row[0]" class="data-card">
              <span>{{ row[0] }}</span>
              <strong>{{ row[1] }}</strong>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>估值来源</h3>
            <span class="panel-note">可用于判断可信度</span>
          </div>
          <div class="info-list">
            <div v-for="row in valuationRows" :key="row[0]" class="info-row">
              <span>{{ row[0] }}</span>
              <strong>{{ row[1] }}</strong>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="currentTab === 'history'">
        <section class="panel">
          <div class="panel-head">
            <h3>历史记录</h3>
            <span class="panel-note">{{ historyRows.length }} 条</span>
          </div>
          <div class="table-wrap">
            <div class="table head">
              <span>日期</span>
              <span>净值</span>
              <span>净值变动</span>
              <span>溢价</span>
              <span>收益</span>
            </div>
            <div v-for="row in historyRows" :key="row.date" class="table">
              <span>{{ row.date }}</span>
              <span>{{ row.nav }}</span>
              <span :class="row.nav_change.includes('-') ? 'text-success' : 'text-danger'">{{ row.nav_change }}</span>
              <span>{{ row.premium }}</span>
              <span :class="row.estimated_profit.includes('-') ? 'text-success' : 'text-danger'">{{ row.estimated_profit }}</span>
            </div>
          </div>
          <p class="foot-note">历史数据仅用于辅助观察，不代表后续一定重复。</p>
        </section>
      </template>

      <template v-else>
        <section class="strategy-stack">
          <article v-for="item in strategyCards" :key="item.title" class="strategy-card">
            <div class="strategy-head">
              <h3>{{ item.title }}</h3>
              <span class="strategy-tag">仅供参考</span>
            </div>
            <p>{{ item.strategy }}</p>
            <div class="strategy-grid">
              <div>
                <span>成功率</span>
                <strong>{{ item.success_rate }}</strong>
              </div>
              <div>
                <span>发生次数</span>
                <strong>{{ item.occurrence_count }}</strong>
              </div>
              <div>
                <span>总收益率</span>
                <strong>{{ item.total_return }}</strong>
              </div>
              <div>
                <span>出现概率</span>
                <strong>{{ item.probability }}</strong>
              </div>
            </div>
          </article>
        </section>
      </template>
    </template>

    <footer class="bottom-bar">
      <button class="secondary-btn" @click="toggleFavorite">{{ favoriteActive ? '已加入自选' : '加入自选' }}</button>
      <button class="secondary-btn" @click="toggleReminder('sell')">{{ reminderSellActive ? '已开启卖点提醒' : '开启卖点提醒' }}</button>
      <button class="primary-btn" @click="switchTab(tabs.find((item) => item.key === 'history') || tabs[0])">查看更多历史</button>
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
    radial-gradient(circle at top left, rgba(74, 144, 226, 0.18), transparent 30%),
    radial-gradient(circle at right top, rgba(41, 179, 126, 0.10), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 14%),
    #1a1e2b;
  animation: detail-page-fade 220ms ease-out;
}
.topbar,
.hero-head,
.panel-head,
.strategy-head,
.hero-actions,
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
  background: rgba(36, 43, 61, 0.9);
  border: 1px solid rgba(234, 236, 240, 0.08);
  color: var(--lof-text);
  font-size: 24px;
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}
.ghost-btn {
  min-width: 64px;
  height: 38px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  font-size: 12px;
  font-weight: 700;
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}
.title-block {
  flex: 1;
}
.title-block h1 {
  font-size: 22px;
  line-height: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--lof-text);
}
.title-block p,
.panel-note,
.foot-note,
.timeline-row p,
.strategy-card p,
.info-row span,
.table span,
.risk-list li {
  color: var(--lof-muted);
  font-size: 12px;
  line-height: 18px;
}
.hero-card,
.panel,
.state-card,
.strategy-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02)),
    rgba(36, 43, 61, 0.96);
  border: 1px solid rgba(234, 236, 240, 0.08);
  box-shadow: var(--lof-shadow);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}
.state-card {
  text-align: center;
  color: var(--lof-muted);
}

.detail-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.skeleton-block {
  border-radius: 18px;
  border: 1px solid rgba(234, 236, 240, 0.06);
  background:
    linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.03) 52%),
    rgba(36, 43, 61, 0.96);
  background-size: 220% 100%;
  animation: detail-shimmer 1.4s linear infinite;
}

.skeleton-block.hero {
  height: 164px;
}

.skeleton-block.tabs {
  height: 50px;
}

.skeleton-block.card {
  height: 180px;
}
.hero-card h2,
.panel h3,
.strategy-card h3 {
  color: var(--lof-text);
  font-size: 18px;
  line-height: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.hero-price {
  text-align: right;
}
.hero-price span,
.tag,
.data-card span,
.strategy-grid span,
.timeline-index,
.info-row span {
  display: block;
  font-size: 11px;
  line-height: 16px;
}
.hero-price strong {
  display: block;
  margin-top: 4px;
  font-family: 'Roboto Mono', 'Menlo', monospace;
  font-size: 32px;
  line-height: 36px;
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
  font-weight: 600;
}
.tag-neutral {
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  box-shadow: inset 0 0 0 1px rgba(74, 144, 226, 0.08);
}
.risk-low {
  background: rgba(0, 200, 83, 0.16);
  color: var(--lof-success);
}
.risk-mid {
  background: rgba(255, 140, 0, 0.16);
  color: var(--lof-warning);
}
.risk-high {
  background: rgba(255, 77, 79, 0.16);
  color: var(--lof-danger);
}
.hero-actions {
  margin-top: 16px;
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
  border: 1px solid rgba(234, 236, 240, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--lof-muted);
  font-size: 12px;
  font-weight: 600;
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}
.tab-btn.active {
  border-color: rgba(74, 144, 226, 0.3);
  background: rgba(74, 144, 226, 0.18);
  color: var(--lof-text);
}
.conclusion-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(74, 144, 226, 0.08), rgba(255, 255, 255, 0.03));
}
.conclusion-card strong {
  display: block;
  color: var(--lof-text);
  font-size: 18px;
  line-height: 26px;
  font-weight: 800;
}
.conclusion-card p + p {
  margin-top: 6px;
}
.stat-grid,
.data-grid,
.strategy-grid,
.judgement-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.stat-grid,
.data-grid,
.judgement-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.strategy-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.stat-card,
.data-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(234, 236, 240, 0.05);
  backdrop-filter: blur(4px);
}

.data-card.is-judgement {
  background: linear-gradient(180deg, rgba(74, 144, 226, 0.10), rgba(255, 255, 255, 0.03));
}
.stat-card strong,
.data-card strong,
.strategy-grid strong,
.timeline-row strong,
.info-row strong {
  display: block;
  margin-top: 4px;
  color: var(--lof-text);
  font-size: 18px;
  line-height: 24px;
  font-weight: 800;
}
.stat-card.warning strong {
  color: var(--lof-warning);
}
.stat-card.danger strong {
  color: var(--lof-danger);
}
.timeline {
  margin-top: 12px;
}
.timeline-row {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid rgba(234, 236, 240, 0.08);
}
.timeline-row:last-child,
.info-row:last-child,
.table:last-child {
  border-bottom: 0;
}
.timeline-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  text-align: center;
  line-height: 28px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(74, 144, 226, 0.16);
}
.risk-list {
  margin-top: 8px;
  padding-left: 18px;
}
.risk-list li + li {
  margin-top: 8px;
}
.info-list,
.table-wrap {
  margin-top: 12px;
}
.info-row,
.table {
  display: grid;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(234, 236, 240, 0.08);
}
.info-row {
  grid-template-columns: 1fr auto;
}
.table {
  grid-template-columns: 72px repeat(4, minmax(0, 1fr));
  font-size: 12px;
}
.table.head {
  padding-top: 0;
  color: #8b96ab;
  font-weight: 600;
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
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  font-size: 11px;
  font-weight: 700;
}
.strategy-card p {
  margin-top: 10px;
}
.primary-btn,
.secondary-btn {
  min-height: 46px;
  padding: 0 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;
}
.primary-btn {
  background: linear-gradient(90deg, #2d6bc4 0%, #4a90e2 100%);
  color: #fff;
}
.secondary-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(234, 236, 240, 0.08);
  color: var(--lof-text);
}
.bottom-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, calc(100vw - 20px));
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  background: rgba(22, 26, 35, 0.96);
  border-top: 1px solid rgba(234, 236, 240, 0.08);
  backdrop-filter: blur(12px);
}
.text-danger {
  color: var(--lof-danger) !important;
}
.text-success {
  color: var(--lof-success) !important;
}

.hero-card:hover,
.panel:hover,
.strategy-card:hover {
  transform: translateY(-1px);
  border-color: rgba(74, 144, 226, 0.16);
}

.nav-btn:hover,
.ghost-btn:hover,
.tab-btn:hover,
.primary-btn:hover,
.secondary-btn:hover {
  transform: translateY(-1px);
}

@keyframes detail-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@keyframes detail-page-fade {
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
  .tabs,
  .stat-grid,
  .data-grid,
  .strategy-grid,
  .bottom-bar {
    grid-template-columns: 1fr;
  }
  .hero-head,
  .hero-actions,
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .bottom-bar {
    display: grid;
    width: min(430px, calc(100vw - 24px));
  }
}
</style>
