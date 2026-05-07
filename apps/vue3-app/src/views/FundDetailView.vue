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
  { key: 'core', label: '核心', routeName: 'fund-detail-core' },
  { key: 'realtime', label: '实时', routeName: 'fund-detail-realtime' },
  { key: 'history', label: '历史', routeName: 'fund-detail-history' },
  { key: 'strategy', label: '策略', routeName: 'fund-detail-strategy' },
]

const fund = computed(() => detail.value?.fund ?? null)
const historyRows = computed(() => detail.value?.nav_history ?? [])
const strategyCards = computed(() => detail.value?.arbitrage_strategies ?? [])
const fiveLevelBid = computed(() => detail.value?.five_level.bid ?? [])
const fiveLevelAsk = computed(() => detail.value?.five_level.ask ?? [])

const tags = computed(() => {
  if (!fund.value) return []
  return [...new Set([fund.value.fund_type, fund.value.fund_state, fund.value.market_type].filter(Boolean))]
})

const startDateText = computed(() => {
  const startDate = detail.value?.historical_stats.start_date
  if (!startDate) return '--'
  const parsed = new Date(startDate)
  if (Number.isNaN(parsed.getTime())) return startDate
  return `${String(parsed.getFullYear()).slice(-2)}年${parsed.getMonth() + 1}月${parsed.getDate()}日`
})

function sourceLabel(source: string) {
  if (!source) return '--'
  if (source.includes('fallback_for_iopv')) return '回退估值'
  if (source.includes('fallback_for_estimate')) return '回退净值'
  if (source === 'heuristic_rule') return '规则估算'
  if (source.includes('iopv')) return '实时 IOPV'
  if (source.includes('estimate')) return '盘中估算'
  if (source.includes('official')) return '官方净值'
  if (source.includes('eastmoney_fee_rank')) return '费率资料'
  if (source.includes('legacy-fund-service')) return '基础数据源'
  return source
}

const backtestRows = computed(() => {
  const stats = detail.value?.historical_stats
  if (!stats) return []
  return [
    { label: '触发次数', value: String(stats.trigger_count || 0), tone: '' },
    { label: '成功率', value: stats.success_rate || '--', tone: '' },
    { label: '平均收益', value: stats.avg_return_rate || '--', tone: 'accent' },
    { label: '出现概率', value: stats.occurrence_probability || '--', tone: '' },
  ]
})

const currentRows = computed(() => {
  if (!fund.value || !detail.value) return []
  return [
    { label: '场内价格', value: fund.value.market_price_display, tone: '' },
    { label: '参考净值', value: fund.value.nav_price_display || '--', tone: '' },
    { label: '当前溢价率', value: fund.value.premium_display, tone: fund.value.up ? 'red' : 'green' },
    { label: '申购状态', value: fund.value.fund_state || '--', tone: '' },
    { label: '基金规模', value: detail.value.scale || '--', tone: '' },
    { label: '成交额', value: detail.value.turnover || '--', tone: '' },
    { label: '风险等级', value: detail.value.risk.risk_level || '--', tone: '' },
    { label: '数据质量', value: detail.value.quality.data_quality_status || '--', tone: '' },
  ]
})

const valuationRows = computed(() => {
  const valuation = detail.value?.valuation
  if (!valuation) return []
  return [
    { label: '官方净值来源', value: sourceLabel(valuation.official_nav_source) },
    { label: '估算净值来源', value: sourceLabel(valuation.estimate_nav_source) },
    { label: 'IOPV 来源', value: sourceLabel(valuation.iopv_source) },
    { label: '估算净值', value: valuation.estimate_nav_value == null ? '--' : String(valuation.estimate_nav_value) },
    { label: 'IOPV', value: valuation.iopv_nav_value == null ? '--' : String(valuation.iopv_nav_value) },
  ]
})

const feeRows = computed(() => {
  const fee = detail.value?.fee_profile
  if (!fee) return []
  return [
    { label: '费率来源', value: sourceLabel(fee.source) },
    { label: '费率文本', value: fee.fee_text || '--' },
    { label: '申购费率', value: fee.purchase_fee_rate == null ? '--' : `${fee.purchase_fee_rate}%` },
    { label: '赎回费率', value: fee.redemption_fee_rate == null ? '--' : `${fee.redemption_fee_rate}%` },
    { label: '管理费', value: fee.management_fee_rate == null ? '--' : `${fee.management_fee_rate}%` },
    { label: '托管费', value: fee.custody_fee_rate == null ? '--' : `${fee.custody_fee_rate}%` },
    { label: '销售服务费', value: fee.service_fee_rate == null ? '--' : `${fee.service_fee_rate}%` },
  ]
})

const qdiiRows = computed(() => {
  const qdii = detail.value?.qdii
  if (!qdii) return []
  return [
    { label: '是否 QDII', value: qdii.is_qdii ? '是' : '否' },
    { label: '是否跨市场', value: qdii.is_cross_border ? '是' : '否' },
    { label: '交易日市场', value: qdii.calendar_market || '--' },
    { label: '套利分类', value: qdii.arbitrage_category || '--' },
    { label: '跟踪指数代码', value: qdii.underlying_index_code || '--' },
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
  const marketType = String(route.query.marketType || 'LOF')
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
  const starred = !lofStore.favoriteSet.has(fund.value.code)
  try {
    await updateFavorite(fund.value.code, fund.value.market_type, deviceId, starred)
    lofStore.toggleFavorite(fund.value.code)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '更新自选失败'
  }
}

function toggleReminder(type: string) {
  if (fund.value) lofStore.toggleReminder(`${fund.value.code}:${type}`)
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
      <button class="back" @click="router.back()"></button>
      <div class="title-block">
        <h1>{{ fund?.name || '基金详情' }}</h1>
        <p>{{ fund?.code || '--' }}</p>
      </div>
      <button class="star" :class="{ active: fund && lofStore.favoriteSet.has(fund.code) }" @click="toggleFavorite"></button>
    </header>

    <section v-if="error" class="state-block">{{ error }}</section>
    <section v-else-if="loading" class="state-block">正在加载详情数据...</section>

    <template v-else-if="detail && fund">
      <section class="hero">
        <div class="headline">
          <div>
            <div class="headline-label">当前溢价率</div>
            <div :class="['headline-value', fund.up ? 'red' : 'green']">{{ fund.premium_display }}</div>
          </div>
          <button class="favorite-switch" :class="{ active: lofStore.favoriteSet.has(fund.code) }" @click="toggleFavorite">
            <span class="favorite-knob"></span>
          </button>
        </div>

        <div class="headline-sub">
          <span>场内价格：{{ fund.market_price_display }}</span>
          <span>参考净值：{{ fund.nav_price_display || '--' }}</span>
        </div>

        <div v-if="tags.length" class="tag-row">
          <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </section>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="{ active: currentTab === tab.key }"
          @click="switchTab(tab)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <template v-if="currentTab === 'core'">
        <section class="summary-section">
          <div class="summary-head">
            <span class="pill danger">历史统计</span>
            <span class="pill info">始于：{{ startDateText }}</span>
          </div>

          <div class="summary-grid">
            <div v-for="item in backtestRows" :key="item.label" class="summary-item" :class="{ highlight: item.tone === 'accent' }">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="meta-block">
          <div class="meta-row"><span>更新时间</span><strong>{{ detail.update_time || '--' }}</strong></div>
          <div class="meta-row"><span>基金规模</span><strong>{{ detail.scale || '--' }}</strong></div>
          <div class="meta-row"><span>成交额</span><strong>{{ detail.turnover || '--' }}</strong></div>
        </section>

        <section class="data-block">
          <div class="section-title">关键数据</div>
          <div class="data-list">
            <div v-for="item in currentRows" :key="item.label" class="data-row">
              <span>{{ item.label }}</span>
              <strong :class="item.tone">{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="data-block">
          <div class="section-title">估值来源</div>
          <div class="data-list">
            <div v-for="item in valuationRows" :key="item.label" class="data-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="data-block">
          <div class="section-title">费率资料</div>
          <div class="data-list">
            <div v-for="item in feeRows" :key="item.label" class="data-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="data-block">
          <div class="section-title">QDII / 跨市场信息</div>
          <div class="data-list">
            <div v-for="item in qdiiRows" :key="item.label" class="data-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="currentTab === 'realtime'">
        <section class="table-card">
          <div class="section-title">实时五档折溢价</div>
          <div class="section-minor">{{ detail.five_level.update_time || detail.update_time || '--' }}</div>
          <div class="table-wrap">
            <div class="table five">
              <div class="row head">
                <span>档位</span>
                <span>卖价</span>
                <span>买价</span>
                <span>溢价</span>
                <span>量</span>
              </div>
              <div v-for="(ask, index) in fiveLevelAsk" :key="`${ask.price}-${index}`" class="row">
                <span>{{ index + 1 }}</span>
                <span>{{ ask.price ?? '--' }}</span>
                <span>{{ fiveLevelBid[index]?.price ?? '--' }}</span>
                <span class="red">{{ ask.premium }}</span>
                <span>{{ ask.volume }}</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="currentTab === 'history'">
        <section class="table-card">
          <div class="section-title">历史净值与收益</div>
          <div class="section-minor">{{ historyRows.length }} 条</div>
          <div class="table-wrap">
            <div class="table history">
              <div class="row head">
                <span>日期</span>
                <span>净值</span>
                <span>净值变动</span>
                <span>溢价</span>
                <span>收益</span>
              </div>
              <div v-for="row in historyRows" :key="row.date" class="row">
                <span>{{ row.date }}</span>
                <span>{{ row.nav }}</span>
                <span :class="{ red: !row.nav_change.includes('-'), green: row.nav_change.includes('-') }">{{ row.nav_change }}</span>
                <span>{{ row.premium }}</span>
                <span :class="{ red: row.estimated_profit.includes('+'), green: row.estimated_profit.includes('-') }">{{ row.estimated_profit }}</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="strategy-list">
          <article v-for="item in strategyCards" :key="item.title" class="strategy-card">
            <div class="section-title">{{ item.title }}</div>
            <div class="section-minor">{{ item.probability }}</div>
            <p>{{ item.strategy }}</p>
            <div class="strategy-meta">
              <span>成功率 {{ item.success_rate }}</span>
              <span>发生次数 {{ item.occurrence_count }}</span>
            </div>
          </article>
        </section>
      </template>
    </template>

    <footer class="footer">
      <button class="secondary" @click="toggleFavorite">{{ fund && lofStore.favoriteSet.has(fund.code) ? '已加入自选' : '加入自选' }}</button>
      <button class="secondary" @click="toggleReminder('arrival')">{{ fund && lofStore.reminderSet.has(`${fund.code}:arrival`) ? '已开提醒' : '开启提醒' }}</button>
      <button class="primary" @click="switchTab(tabs.find((tab) => tab.key === (currentTab === 'history' ? 'core' : 'history'))!)">
        {{ currentTab === 'history' ? '查看核心' : '查看历史' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 92px; background: #fff; }
.topbar { display: grid; grid-template-columns: 18px 1fr 18px; gap: 12px; align-items: start; }
.back, .star { border: 0; background: none; position: relative; width: 18px; height: 18px; }
.back::before { content: ''; position: absolute; left: 2px; top: 7px; width: 10px; height: 10px; border-left: 2px solid #1f3348; border-bottom: 2px solid #1f3348; transform: rotate(45deg); }
.star { clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 72%, 21% 92%, 32% 57%, 2% 35%, 39% 35%); background: #fff; border: 1px solid #d7dde5; }
.star.active { background: #f6d76d; border-color: #f6d76d; }
.title-block h1 { font-size: 24px; line-height: 1.15; font-weight: 700; }
.title-block p { margin-top: 4px; color: #8793a0; font-size: 12px; }
.state-block, .hero, .summary-section, .meta-block, .data-block, .table-card, .strategy-card { margin-top: 12px; }
.state-block { color: #55697f; font-size: 13px; }
.headline-label, .hero-cell span, .pill, .section-minor, .table .row span, .strategy-meta span, .meta-row span, .data-row span { font-size: 11px; color: #7b8894; }
.hero { padding-bottom: 10px; border-bottom: 1px solid #edf2f6; }
.headline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.headline-value { margin-top: 6px; font-size: 34px; line-height: 1; font-weight: 700; }
.favorite-switch { position: relative; width: 48px; height: 28px; border: 0; border-radius: 999px; background: #d7e0e8; }
.favorite-switch.active { background: #2a95ff; }
.favorite-knob { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); }
.favorite-switch.active .favorite-knob { left: 22px; }
.headline-sub { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; color: #203346; font-size: 14px; font-weight: 600; }
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag { padding: 3px 8px; border-radius: 999px; background: #eef4f8; color: #506779; font-size: 10px; }
.tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
.tabs button { height: 38px; border-radius: 14px; border: 1px solid #dfe7ee; background: #fff; color: #6f7f8b; font-size: 13px; }
.tabs button.active { background: #e9f7f3; color: #0f8c76; border-color: #bfe8dc; font-weight: 700; }
.summary-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pill { display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px; }
.pill.danger { background: #ffedf0; color: #e5484d; }
.pill.info { background: #edf5ff; color: #397bd7; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin-top: 14px; }
.summary-item strong { display: block; margin-top: 4px; color: #203346; font-size: 20px; line-height: 1.15; }
.summary-item.highlight strong, .accent { color: #f08b1d; }
.meta-block { display: flex; flex-wrap: wrap; gap: 6px 18px; padding-bottom: 10px; border-bottom: 1px solid #edf2f6; }
.meta-row strong { margin-left: 6px; color: #203346; font-size: 12px; }
.section-title { color: #203346; font-size: 15px; font-weight: 700; }
.section-minor { margin-top: 4px; line-height: 1.6; }
.data-list { margin-top: 10px; }
.data-list.extra { margin-top: 0; }
.data-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid #edf2f6; }
.data-row strong { color: #203346; font-size: 15px; line-height: 1.35; text-align: right; }
.table-wrap { margin-top: 10px; overflow-x: auto; }
.table { min-width: 560px; }
.table.history { min-width: 620px; }
.row { display: grid; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid #edf2f6; font-size: 12px; }
.five .row { grid-template-columns: 42px repeat(4, minmax(0, 1fr)); }
.history .row { grid-template-columns: 100px repeat(4, minmax(0, 1fr)); }
.strategy-list { display: flex; flex-direction: column; gap: 14px; }
.strategy-card p { margin-top: 12px; color: #55697f; font-size: 13px; line-height: 1.8; }
.strategy-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.red { color: #e34b51 !important; }
.green { color: #1ca66d !important; }
.footer { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); background: rgba(255, 255, 255, 0.98); border-top: 1px solid #e7edf2; }
.footer button { height: 46px; padding: 0 10px; border-radius: 14px; border: 1px solid #dfe7ee; background: #fff; color: #203346; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.footer .primary { background: linear-gradient(180deg, #16ac93 0%, #10947d 100%); border: 0; color: #fff; }
@media (max-width: 380px) {
  .page { padding-left: 12px; padding-right: 12px; }
  .summary-grid { grid-template-columns: 1fr; }
  .tabs { gap: 6px; }
  .tabs button { font-size: 12px; }
  .footer { gap: 8px; padding-left: 12px; padding-right: 12px; }
}
</style>
