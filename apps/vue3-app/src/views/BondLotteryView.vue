<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchBondLottery, queryBondLottery, type BondLotteryItem } from '@/lib/save-api'

const loading = ref(false)
const querying = ref(false)
const error = ref('')
const updateTime = ref('')
const bondOptions = ref<BondLotteryItem[]>([])
const selectedBond = ref<BondLotteryItem | null>(null)
const queryValue = ref('')
const queryResults = ref<
  Array<{
    allocation_number: string
    matched: boolean
    hit_labels: string[]
    hit_suffixes: string[]
  }>
>([])

const hasData = computed(() => selectedBond.value !== null)

function formatRate(value: number | null) {
  if (value === null || value === undefined) {
    return '--'
  }
  return `${value.toFixed(2)}%`
}

async function loadLottery(code?: string) {
  loading.value = true
  error.value = ''

  try {
    const response = await fetchBondLottery(code)
    bondOptions.value = response.bonds
    selectedBond.value = response.selected
    updateTime.value = response.update_time
    queryResults.value = []
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function runQuery() {
  if (!selectedBond.value || !queryValue.value.trim()) {
    return
  }

  querying.value = true
  error.value = ''
  try {
    const response = await queryBondLottery(selectedBond.value.code, queryValue.value)
    queryResults.value = response.results
    updateTime.value = response.update_time
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '查询失败'
  } finally {
    querying.value = false
  }
}

function selectBond(item: BondLotteryItem) {
  if (selectedBond.value?.code === item.code) {
    return
  }
  queryValue.value = ''
  void loadLottery(item.code)
}

onMounted(() => {
  void loadLottery()
})
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="title">可转债中签早知道</div>
      <div class="brand">韭零后小站的储钱助手</div>
    </header>

    <div class="notice">
      🔊 可转债中签早知道，用逗号“,”隔开可以批量查询
    </div>

    <section class="panel">
      <div v-if="error" class="status-card error-card">{{ error }}</div>
      <div v-else-if="loading" class="status-card">正在加载中签数据...</div>
      <div v-else-if="!hasData" class="status-card">当前暂无可展示的中签数据</div>

      <template v-else-if="selectedBond">
        <div class="bond-tabs">
          <button
            v-for="bond in bondOptions.slice(0, 6)"
            :key="bond.code"
            type="button"
            :class="['bond-pill', { active: bond.code === selectedBond.code }]"
            @click="selectBond(bond)"
          >
            {{ bond.name }}
          </button>
        </div>

        <div class="hero-chip">
          {{ selectedBond.name }}（{{ selectedBond.code }}）（中签率：{{ formatRate(selectedBond.winning_rate) }}）
        </div>

        <div class="query-row">
          <label class="query-label">起始配号</label>
          <input v-model="queryValue" class="query-input" placeholder="请输入起始配号查询" />
          <button type="button" class="query-btn" :disabled="querying" @click="runQuery">
            {{ querying ? '查询中' : '查询' }}
          </button>
        </div>

        <div v-if="queryResults.length > 0" class="query-results">
          <div
            v-for="item in queryResults"
            :key="item.allocation_number"
            :class="['query-result-card', { hit: item.matched }]"
          >
            <span class="query-no">{{ item.allocation_number }}</span>
            <span class="query-status">{{ item.matched ? '中签' : '未命中' }}</span>
            <span class="query-detail">
              {{ item.matched ? item.hit_labels.join('、') : '未匹配到任何中签尾号' }}
            </span>
          </div>
        </div>

        <div class="result-table">
          <div v-for="row in selectedBond.groups" :key="row.label" class="result-row">
            <span class="result-label">{{ row.label }}</span>
            <span class="result-value">{{ row.suffixes.join(',') }}</span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: calc(10px + env(safe-area-inset-top)) 0 calc(18px + env(safe-area-inset-bottom));
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

.notice {
  padding: 14px 18px;
  background: #fff7d6;
  color: #f97316;
  font-size: 13px;
}

.panel {
  margin-top: 14px;
  background: #fff;
}

.status-card {
  padding: 24px 16px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.error-card {
  color: #dc2626;
}

.bond-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 14px 14px 0;
  -webkit-overflow-scrolling: touch;
}

.bond-tabs::-webkit-scrollbar {
  display: none;
}

.bond-pill {
  flex: 0 0 auto;
  padding: 7px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 12px;
}

.bond-pill.active {
  border-color: #ff1744;
  background: #ff1744;
  color: #fff;
  font-weight: 700;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 18px auto 18px;
  padding: 7px 16px;
  border-radius: 999px;
  background: #ff1744;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.query-row {
  display: grid;
  grid-template-columns: 96px 1fr 72px;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid #eef2f7;
  border-bottom: 1px solid #eef2f7;
}

.query-label {
  color: #111827;
  font-size: 13px;
}

.query-input {
  min-width: 0;
  height: 40px;
  border: 0;
  outline: none;
  background: transparent;
  color: #111827;
  font-size: 13px;
}

.query-input::placeholder {
  color: #9ca3af;
}

.query-btn {
  height: 38px;
  border: 0;
  border-radius: 4px;
  background: #16a34a;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.query-btn:disabled {
  opacity: 0.7;
}

.query-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 18px 0;
}

.query-result-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.query-result-card.hit {
  background: #fff1f2;
}

.query-no {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.query-status {
  color: #ff1744;
  font-size: 12px;
  font-weight: 700;
}

.query-detail {
  grid-column: 1 / -1;
  color: #64748b;
  font-size: 11px;
}

.result-table {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
}

.result-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 18px;
  padding: 14px 18px;
  border-bottom: 1px solid #eef2f7;
  font-size: 13px;
  line-height: 1.45;
}

.result-label {
  color: #111827;
}

.result-value {
  color: #334155;
}

@media (max-width: 760px) {
  .query-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .result-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
