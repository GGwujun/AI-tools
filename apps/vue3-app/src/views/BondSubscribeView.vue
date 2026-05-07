<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchBondSubscribeList, type BondSubscribeItem } from '@/lib/save-api'

const loading = ref(false)
const error = ref('')
const updateTime = ref('')
const bonds = ref<BondSubscribeItem[]>([])

const hasData = computed(() => bonds.value.length > 0)

function formatDate(value?: string | null) {
  if (!value || value === '待定') {
    return '待定'
  }
  return value.slice(5)
}

function formatPrice(value: number | null, suffix = '元') {
  if (value === null || value === undefined) {
    return '待计算'
  }
  return `${value.toFixed(2)}${suffix}`
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) {
    return '--'
  }
  return `${value.toFixed(2)}%`
}

function themeText(item: BondSubscribeItem) {
  return item.themes.length > 0 ? item.themes.join('、') : '暂无题材说明'
}

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetchBondSubscribeList()
    bonds.value = response.items
    updateTime.value = response.update_time
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="title">可转债(打新/上市)提醒小工具</div>
      <div class="brand">韭零后小站的储钱助手</div>
    </header>

    <section class="meta-bar">
      <span class="meta-label">数据更新时间</span>
      <span class="meta-time">{{ updateTime || '等待同步' }}</span>
    </section>

    <section class="list">
      <div v-if="error" class="status-card error-card">{{ error }}</div>
      <div v-else-if="loading" class="status-card">正在加载可转债申购数据...</div>
      <div v-else-if="!hasData" class="status-card">当前暂无可展示的新债数据</div>

      <article v-for="bond in bonds" :key="bond.code" class="bond-card">
        <div class="bond-head">
          <div class="bond-title">
            <span class="bond-name">{{ bond.name }}</span>
            <span class="bond-code">(转债代码：{{ bond.code }})</span>
          </div>
        </div>

        <div class="timeline">
          <div class="timeline-top">
            <span class="step-label left">申购日({{ formatDate(bond.subscribe_date) }})</span>
            <span class="step-label middle">中签缴款日({{ formatDate(bond.pay_date) }})</span>
            <span class="step-label right">上市日({{ formatDate(bond.listing_date) }})</span>
          </div>
          <div class="timeline-line">
            <span class="line done"></span>
            <span class="dot start"></span>
            <span class="dot middle active"></span>
            <span class="dot end"></span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="label-col">
            <span>正股名称</span>
            <span>转股价值(溢价率)</span>
            <span>规模(信用等级)</span>
            <span>参考价格</span>
            <span>上市流通规模</span>
            <span>概念题材</span>
            <span>申购参考</span>
          </div>

          <div class="value-col">
            <span>{{ bond.stock_name }}({{ bond.stock_code }})</span>
            <span>
              {{ formatPrice(bond.convert_value) }}
              <em>({{ formatPercent(bond.premium_rate) }})</em>
            </span>
            <span>{{ bond.issue_size }}({{ bond.rating }})</span>
            <span class="highlight">
              {{ formatPrice(bond.reference_price) }}
              <template v-if="bond.reference_price_change !== null && bond.reference_price_change !== undefined">
                ({{ formatPercent(bond.reference_price_change) }})
              </template>
            </span>
            <span class="subtle">{{ bond.circulation_scale }}</span>
            <span class="theme">{{ themeText(bond) }}</span>
            <span class="suggestion">{{ bond.suggestion }}</span>
          </div>
        </div>

        <div class="card-actions">
          <span v-if="bond.limit_tag" class="tag limit">{{ bond.limit_tag }}</span>
          <span v-if="bond.paused" class="tag paused">待上市</span>
          <button type="button" class="btn secondary">打新提醒</button>
          <button type="button" class="btn primary">上市提醒</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: calc(10px + env(safe-area-inset-top)) 10px calc(18px + env(safe-area-inset-bottom));
  background: #f3f4f6;
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 0;
  z-index: 10;
  min-height: 48px;
  margin: 0 -10px 10px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid #eceff3;
}

.title {
  color: #111827;
  font-size: 14px;
  font-weight: 500;
}

.brand {
  position: absolute;
  right: 12px;
  color: #f97316;
  font-size: 12px;
  font-weight: 700;
}

.meta-bar {
  display: flex;
  justify-content: space-between;
  padding: 0 4px 8px;
  color: #6b7280;
  font-size: 12px;
}

.meta-time {
  color: #f97316;
  font-weight: 700;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-card {
  padding: 24px 16px;
  border-radius: 12px;
  background: #fff;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.error-card {
  color: #dc2626;
}

.bond-card {
  padding: 14px 14px 12px;
  border-radius: 12px;
  background: #fff;
}

.bond-title {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.bond-code {
  font-weight: 500;
}

.timeline {
  margin-top: 12px;
}

.timeline-top {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  color: #6b7280;
  font-size: 11px;
}

.step-label.middle {
  color: #f97316;
  text-align: center;
}

.step-label.right {
  text-align: right;
}

.timeline-line {
  position: relative;
  height: 16px;
  margin-top: 6px;
}

.line {
  position: absolute;
  top: 7px;
  left: 14px;
  right: 14px;
  height: 1px;
  background: #d1d5db;
}

.line.done {
  right: 50%;
  background: #f97316;
}

.dot {
  position: absolute;
  top: 3px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #9ca3af;
}

.dot.start {
  left: 14px;
  background: #f97316;
}

.dot.middle {
  left: calc(50% - 4px);
}

.dot.middle.active {
  background: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
}

.dot.end {
  right: 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 10px;
  margin-top: 16px;
}

.label-col,
.value-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  line-height: 1.45;
}

.label-col {
  color: #111827;
}

.value-col {
  color: #6b7280;
  text-align: right;
}

.value-col em {
  color: #ff2d20;
  font-style: normal;
}

.highlight {
  color: #f97316;
  font-weight: 700;
}

.subtle {
  color: #9ca3af;
}

.theme {
  color: #f97316;
  font-weight: 700;
}

.suggestion {
  color: #dc2626;
  font-weight: 800;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.tag {
  padding: 3px 7px;
  border-radius: 999px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.tag.limit {
  background: #fb923c;
}

.tag.paused {
  background: #ef4444;
}

.btn {
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.btn.secondary {
  background: #d4d4d8;
  color: #fff;
}

.btn.primary {
  background: #ef4444;
  color: #fff;
}

@media (max-width: 760px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .value-col {
    text-align: left;
  }

  .card-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
