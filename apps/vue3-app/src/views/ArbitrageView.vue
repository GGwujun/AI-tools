<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const currentTab = ref(0)

const tabs = ['股票型LOF', '指数型LOF', '机会多多', '无时差ETF', '我的自选']

const tabDescs = [
  '主要投资主动型股票的LOF基金，适合长期持有并关注溢价机会',
  '主要跟踪指数的被动型基金，费率低、跟踪误差小',
  '筛选溢价率较高、流动性较好的LOF基金，机会较多',
  '24小时可交易，实时净值更新，无时差影响',
  '您自选关注的基金，方便快速查看'
]

const fundNotes = [
  '如果是灰底，说明该基金今日暂停申购',
  '如果是灰底，说明该基金今日暂停申购',
  '如果是灰底，说明该基金今日暂停申购',
  '无时差ETF交易时间更长，溢价机会更多',
  ''
]

const specialNotes: Record<number, string[]> = {
  0: ['国泰价值LOF(501064)限额申购限100万', '添富核心精选混合LOF(501188)限额申购单账户累计限额50万'],
  1: ['鹏华港股通ETF(160632)限额申购单账户累计限额100万'],
  2: [],
  3: ['纳指ETF(513100)限额申购单账户累计限额2000元'],
  4: []
}

interface Fund {
  code: string
  name: string
  price: string
  premium: string
  up: boolean
  starred: boolean
  paused?: boolean
  downDays: number
  maxDownDays: number
}

const allFundLists: Record<number, Fund[]> = {
  0: [
    { code: '163406', name: '兴全合润', price: '1.514', premium: '+2.37%', up: true, starred: true, downDays: 3, maxDownDays: 15 },
    { code: '519736', name: '交银内核驱动', price: '1.602', premium: '+1.14%', up: true, starred: false, downDays: 0, maxDownDays: 12 },
    { code: '163408', name: '兴全轻资产', price: '2.876', premium: '+0.85%', up: true, starred: true, downDays: 5, maxDownDays: 18 },
    { code: '166009', name: '中欧新动力', price: '2.156', premium: '+0.42%', up: true, starred: false, paused: true, downDays: 0, maxDownDays: 10 }
  ],
  1: [
    { code: '160632', name: '鹏华港股通ETF', price: '1.234', premium: '+1.85%', up: true, starred: false, downDays: 0, maxDownDays: 8 },
    { code: '513500', name: '博时标普500ETF', price: '2.156', premium: '+1.23%', up: true, starred: true, downDays: 0, maxDownDays: 10 },
    { code: '513100', name: '国泰纳指ETF', price: '3.567', premium: '+0.96%', up: true, starred: false, downDays: 2, maxDownDays: 12 }
  ],
  2: [
    { code: '163406', name: '兴全合润', price: '1.514', premium: '+2.37%', up: true, starred: true, downDays: 3, maxDownDays: 15 },
    { code: '160632', name: '鹏华港股通ETF', price: '1.234', premium: '+1.85%', up: true, starred: false, downDays: 0, maxDownDays: 8 },
    { code: '519736', name: '交银内核驱动', price: '1.602', premium: '+1.14%', up: true, starred: false, downDays: 0, maxDownDays: 12 },
    { code: '513500', name: '博时标普500ETF', price: '2.156', premium: '+1.23%', up: true, starred: true, downDays: 0, maxDownDays: 10 }
  ],
  3: [
    { code: '513100', name: '国泰纳指ETF', price: '3.567', premium: '+0.96%', up: true, starred: false, downDays: 0, maxDownDays: 0 },
    { code: '513500', name: '博时标普500ETF', price: '2.156', premium: '+0.45%', up: false, starred: true, downDays: 0, maxDownDays: 0 }
  ],
  4: [
    { code: '163406', name: '兴全合润', price: '1.514', premium: '+2.37%', up: true, starred: true, downDays: 3, maxDownDays: 15 },
    { code: '163408', name: '兴全轻资产', price: '2.876', premium: '+0.85%', up: true, starred: true, downDays: 5, maxDownDays: 18 },
    { code: '162605', name: '景顺长城鼎益', price: '1.876', premium: '-0.45%', up: false, starred: true, downDays: 0, maxDownDays: 14 }
  ]
}

const updateTime = ref('')
const fundList = ref<Fund[]>([])
const currentNote = ref('')
const currentSpecialNotes = ref<string[]>([])

const initData = () => {
  const now = new Date()
  const month = now.getMonth() + 1
  const date = now.getDate()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  updateTime.value = `${month}月${date}日 ${hours}:${minutes < 10 ? '0' + minutes : minutes}`
  fundList.value = allFundLists[0] || []
  currentNote.value = fundNotes[0] || ''
  currentSpecialNotes.value = specialNotes[0] || []
}

const onTabChange = (index: number) => {
  currentTab.value = index
  fundList.value = allFundLists[index] || []
  currentNote.value = fundNotes[index] || ''
  currentSpecialNotes.value = specialNotes[index] || []
}

const onStar = (index: number, event: Event) => {
  event.stopPropagation()
  const fund = fundList.value[index]
  if (fund) {
    fund.starred = !fund.starred
    allFundLists[currentTab.value] = fundList.value
  }
}

const onFundTap = (index: number) => {
  const fund = fundList.value[index]
  const fundData = encodeURIComponent(JSON.stringify(fund))
  router.push({ path: '/save/fund-detail', query: { data: fundData } })
}

const goToAlert = () => {
  router.push('/save/switch')
}

initData()
</script>

<template>
  <div class="page">
    <!-- 顶部提示 -->
    <div class="update-time">更新时间: {{ updateTime }}</div>

    <!-- Tab切换 -->
    <div class="tab-bar">
      <div
        v-for="(tab, index) in tabs"
        :key="index"
        :class="['tab-item', { active: currentTab === index }]"
        @click="onTabChange(index)"
      >
        <span class="tab-text">{{ tab }}</span>
      </div>
    </div>

    <!-- 特别备注 -->
    <div v-if="currentSpecialNotes.length > 0" class="special-notes">
      <div v-for="(note, index) in currentSpecialNotes" :key="index" class="special-note">
        {{ note }}
      </div>
    </div>

    <!-- 基金列表 -->
    <div class="content">
      <div class="table-card">
        <!-- 表头 -->
        <div class="table-header">
          <div class="th th-name">基金名称</div>
          <div class="th th-premium">溢价率</div>
          <div class="th th-price">场内价格</div>
          <div class="th th-star">自选</div>
        </div>

        <!-- 数据行 -->
        <div
          v-for="(item, index) in fundList"
          :key="item.code"
          :class="['table-row', { paused: item.paused }]"
          @click="onFundTap(index)"
        >
          <div class="td td-name">
            <span class="fund-name">{{ item.name }}</span>
            <span class="fund-code">{{ item.code }}</span>
            <span v-if="item.downDays > 0" class="fund-red">{{ item.downDays }}/{{ item.maxDownDays }}</span>
          </div>
          <div :class="['td', 'td-premium', item.up ? 'up' : 'down']">
            <span class="premium-value">{{ item.premium }}</span>
          </div>
          <div class="td td-price">
            <span class="price-value">{{ item.price }}</span>
          </div>
          <div class="td td-star" @click="onStar(index, $event)">
            <span :class="['star-icon', { starred: item.starred }]">
              {{ item.starred ? '★' : '☆' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="tips-section">
        <div class="tip-item">{{ currentNote }}</div>
      </div>

      <!-- 跳转到提醒设置 -->
      <div class="alert-btn" @click="goToAlert">
        <span class="alert-icon">🔔</span>
        <span class="alert-text">提醒设置</span>
        <span class="arrow">›</span>
      </div>

      <!-- 免责声明 -->
      <div class="disclaimer">
        <span>数据仅供参考，不构成任何投资建议。</span>
        <span>数据有一定的延时，仅供参考。</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.update-time {
  background: #fff3e0;
  padding: 8px 16px;
  font-size: 12px;
  color: #ff9800;
  text-align: center;
}

.tab-bar {
  display: flex;
  background: white;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab-item {
  flex-shrink: 0;
  padding: 12px 16px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
}

.tab-item.active {
  color: #667eea;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background: #667eea;
}

.special-notes {
  background: #e3f2fd;
  padding: 8px 16px;
}

.special-note {
  font-size: 11px;
  color: #1976d2;
  padding: 2px 0;
}

.content {
  padding: 16px;
}

.table-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.table-header {
  display: flex;
  background: #f5f5f5;
  padding: 12px 8px;
}

.th {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.th-name { flex: 2; }
.th-premium { flex: 1; text-align: center; }
.th-price { flex: 1; text-align: center; }
.th-star { width: 40px; text-align: center; }

.table-row {
  display: flex;
  padding: 12px 8px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.table-row.paused {
  background: #f5f5f5;
  opacity: 0.7;
}

.table-row:last-child {
  border-bottom: none;
}

.td {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.td-name { flex: 2; }
.td-premium { flex: 1; align-items: center; }
.td-price { flex: 1; align-items: center; }
.td-star { width: 40px; align-items: center; cursor: pointer; }

.fund-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: block;
}

.fund-code {
  font-size: 11px;
  color: #999;
  display: block;
}

.fund-red {
  font-size: 11px;
  color: #ff5252;
  display: block;
  margin-top: 2px;
}

.premium-value {
  font-size: 14px;
  font-weight: 600;
}

.td-premium.up .premium-value {
  color: #ff5252;
}

.td-premium.down .premium-value {
  color: #4caf50;
}

.price-value {
  font-size: 14px;
  color: #333;
}

.star-icon {
  font-size: 18px;
  color: #ccc;
}

.star-icon.starred {
  color: #ff9800;
}

.tips-section {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fff3e0;
  border-radius: 8px;
}

.tip-item {
  font-size: 12px;
  color: #ff9800;
}

.alert-btn {
  display: flex;
  align-items: center;
  background: white;
  padding: 14px 16px;
  border-radius: 12px;
  margin-top: 12px;
  cursor: pointer;
}

.alert-icon {
  font-size: 20px;
  margin-right: 12px;
}

.alert-text {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.arrow {
  font-size: 20px;
  color: #ccc;
}

.disclaimer {
  margin-top: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.disclaimer span {
  font-size: 11px;
  color: #999;
}
</style>
