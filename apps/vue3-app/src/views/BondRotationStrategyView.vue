<script setup lang="ts">
import { onMounted, ref } from 'vue'
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

const tabs: Array<{ key: BondTabKey; label: string }> = [
  { key: 'core', label: '核心机会' },
  { key: 'risk', label: '强赎风险' },
  { key: 'strategy', label: '策略参考' },
  { key: 'stock', label: '正股联动' },
]

function initCurrentTab() {
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

async function toggleFavorite() {
  if (!detail.value) return

  const code = detail.value.bond.code
  const starred = !lofStore.favoriteSet.has(code)

  try {
    await updateFavorite(code, 'bond', deviceId, starred)
    lofStore.toggleFavorite(code)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '更新自选失败'
  }
}

onMounted(() => {
  initCurrentTab()
  void loadDetail()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back()"></button>
      <div class="meta">
        <h1>{{ detail?.bond.name || '可转债详情' }}</h1>
        <p>{{ detail?.bond.code || '--' }} ｜ {{ detail?.bond.tags.join(' ｜ ') || '--' }}</p>
      </div>
      <div class="icons">
        <button class="star" :class="{ active: detail && lofStore.favoriteSet.has(detail.bond.code) }" @click="toggleFavorite"></button>
        <button class="share"></button>
      </div>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: currentTab === tab.key }"
        @click="currentTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <template v-if="currentTab === 'core'">
      <section v-if="error" class="notice-card"><p>{{ error }}</p></section>
      <section v-else-if="loading" class="notice-card"><p>正在加载转债详情...</p></section>
      <section v-else class="notice-card">
        <div class="tag">当前处于可关注双低区间，仅供参考</div>
        <p>{{ detail?.conclusion.summary }}</p>
        <p>{{ detail?.conclusion.risk }}</p>
      </section>
      <section class="grid-card">
        <div
          v-for="item in [
            ['转债价格', detail?.bond.price],
            ['转股价值', detail?.bond.convert_value],
            ['转股溢价率', detail?.bond.premium_rate],
            ['双低值', detail?.bond.dual_low],
            ['纯债价值', detail?.bond.pure_bond_value],
            ['到期收益率', detail?.bond.maturity_yield],
            ['剩余规模', detail?.bond.scale],
            ['剩余年限', detail?.bond.remain_years],
            ['强赎状态', detail?.bond.redeem_status],
          ]"
          :key="item[0]"
          class="cell"
        >
          <span>{{ item[0] }}</span>
          <strong>{{ item[1] }}</strong>
        </div>
      </section>
    </template>

    <template v-else-if="currentTab === 'risk'">
      <section class="risk-panel">
        <div class="risk-banner">
          <div>
            <span>强赎风险等级</span>
            <strong>低风险</strong>
          </div>
          <div class="shield"></div>
        </div>
        <div class="checklist">
          <div v-for="item in detail?.risk_items || []" :key="item.label" class="row">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div class="dates">
          <div><span>最近观察日</span><strong>{{ detail?.bond.last_trade_date }}（15天后）</strong></div>
          <div><span>最近转股日</span><strong>{{ detail?.bond.last_convert_date }}（16天后）</strong></div>
        </div>
      </section>
    </template>

    <template v-else-if="currentTab === 'strategy'">
      <section class="strategy-box">
        <article v-for="item in detail?.strategy_cards || []" :key="item.title" class="strategy-card">
          <div class="head-row">
            <h2>{{ item.title }}</h2>
            <span>仅供参考</span>
          </div>
          <p>{{ item.summary }}</p>
          <div class="meta-list">
            <div><span>仓位参考</span><strong>{{ item.position }}</strong></div>
            <div><span>退出参考</span><strong>{{ item.exit }}</strong></div>
            <div><span>风险提示</span><strong>{{ item.risk }}</strong></div>
          </div>
        </article>
      </section>
    </template>

    <template v-else>
      <section class="notice-card">
        <div class="tag">正股联动</div>
        <p>正股名称：{{ detail?.bond.stock_name || '--' }}</p>
        <p>当前更适合结合正股波动与强赎时间节点一起观察，仅供参考。</p>
      </section>
      <section class="grid-card stock-grid">
        <div class="cell">
          <span>正股涨跌幅</span>
          <strong class="up">+2.18%</strong>
        </div>
        <div class="cell">
          <span>所属行业</span>
          <strong>电子制造</strong>
        </div>
        <div class="cell">
          <span>波动标签</span>
          <strong>高弹性</strong>
        </div>
      </section>
    </template>

    <footer class="footer">
      <button>加入自选</button>
      <button>开启提醒</button>
      <button class="primary">{{ currentTab === 'risk' ? '查看策略参考' : '查看风险参考' }}</button>
    </footer>
  </div>
</template>

<style scoped>
.page { min-height:100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 92px; background: var(--lof-bg); }
.topbar { display:grid; grid-template-columns:18px 1fr auto; gap:12px; align-items:start; }
.back, .star, .share { border:0; background:none; position:relative; width:18px; height:18px; }
.back::before { content:''; position:absolute; left:2px; top:7px; width:10px; height:10px; border-left:2px solid #1f3348; border-bottom:2px solid #1f3348; transform:rotate(45deg); }
.meta h1 { font-size:24px; font-weight:700; }
.meta p { margin-top:6px; font-size:11px; color:var(--lof-muted); }
.icons { display:flex; gap:12px; }
.star { clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 72%, 21% 92%, 32% 57%, 2% 35%, 39% 35%); background:#fff; border:1px solid #c8d7e4; }
.star.active { background:#f6d76d; border-color:#f6d76d; }
.share::before { content:''; position:absolute; inset:2px; border:2px solid #1f3348; border-radius:4px; }
.share::after { content:''; position:absolute; right:2px; top:0; width:8px; height:8px; border-top:2px solid #1f3348; border-right:2px solid #1f3348; }
.tabs { display:flex; gap:18px; margin-top:16px; padding-bottom:10px; overflow:auto; }
.tabs button { position:relative; border:0; background:none; font-size:13px; color:var(--lof-muted); white-space:nowrap; }
.tabs button.active { color:var(--lof-primary-deep); font-weight:700; }
.tabs button.active::after { content:''; position:absolute; left:0; right:0; bottom:-8px; height:3px; border-radius:999px; background:var(--lof-primary); }
.notice-card, .risk-panel, .strategy-card { margin-top:14px; background:#fff; border-radius:22px; padding:16px; box-shadow:var(--lof-shadow); }
.tag { display:inline-block; padding:4px 8px; border-radius:999px; background:#edf8f5; color:var(--lof-primary-deep); font-size:10px; font-weight:700; }
.notice-card p { margin-top:10px; font-size:13px; line-height:1.7; color:#55697f; }
.grid-card { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:14px; }
.stock-grid { grid-template-columns:repeat(3,1fr); }
.cell { padding:12px; border-radius:16px; background:#fff; box-shadow:var(--lof-shadow); }
.cell span { display:block; font-size:11px; color:var(--lof-muted); }
.cell strong { display:block; margin-top:6px; font-size:20px; }
.up { color:var(--lof-danger); }
.risk-banner { display:flex; align-items:center; justify-content:space-between; padding:14px; border-radius:18px; background:linear-gradient(135deg, #f6fbff 0%, #edf8f5 100%); }
.risk-banner span { display:block; font-size:12px; color:var(--lof-muted); }
.risk-banner strong { display:block; margin-top:6px; font-size:30px; color:var(--lof-primary-deep); }
.shield { width:56px; height:64px; background:linear-gradient(180deg, #dff9f2 0%, #7fd8c6 100%); clip-path:polygon(50% 0, 88% 14%, 88% 54%, 50% 100%, 12% 54%, 12% 14%); }
.checklist { margin-top:14px; }
.row, .dates div, .meta-list div { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--lof-border); font-size:13px; gap:12px; }
.row strong { color:var(--lof-primary-deep); }
.dates { margin-top:6px; }
.dates span, .meta-list span { color:var(--lof-muted); }
.dates strong, .meta-list strong { font-size:13px; text-align:right; }
.strategy-box { display:flex; flex-direction:column; gap:14px; margin-top:14px; }
.head-row { display:flex; justify-content:space-between; align-items:center; }
.head-row h2 { font-size:18px; }
.head-row span { font-size:11px; color:#ee8f43; }
.strategy-card p { margin-top:12px; font-size:13px; line-height:1.8; color:#55697f; }
.meta-list { margin-top:10px; }
.footer { position:fixed; left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:14px 16px calc(14px + env(safe-area-inset-bottom)); background:rgba(255,255,255,.95); border-top:1px solid var(--lof-border); }
.footer button { height:46px; border-radius:14px; border:1px solid var(--lof-border); background:#fff; }
.footer .primary { background:linear-gradient(180deg, #16ac93 0%, #10947d 100%); color:#fff; border:0; font-weight:700; }
</style>
