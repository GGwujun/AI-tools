<script setup lang="ts">
import { ref } from 'vue'

const trackingNo = ref('')
const selectedCompany = ref('auto')
const isLoading = ref(false)
const showEmpty = ref(true)
const logisticsInfo = ref<{ desc: string; time: string }[]>([])

const companies = [
  { code: 'auto', name: '自动识别', icon: '🔮' },
  { code: 'SF', name: '顺丰', icon: '✈️' },
  { code: 'YTO', name: '圆通', icon: '📮' },
  { code: 'ZTO', name: '中通', icon: '🚚' },
  { code: 'YD', name: '韵达', icon: '📬' },
  { code: 'STO', name: '申通', icon: '📭' },
  { code: 'EMS', name: 'EMS', icon: '🏤' },
  { code: 'JD', name: '京东', icon: '📱' }
]

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  trackingNo.value = target.value
}

const selectCompany = (code: string) => {
  selectedCompany.value = code
}

const queryExpress = () => {
  if (!trackingNo.value.trim()) {
    alert('请输入快递单号')
    return
  }

  isLoading.value = true
  showEmpty.value = false
  logisticsInfo.value = []

  // Simulate API call
  setTimeout(() => {
    const now = new Date()
    const formatTime = (d: Date) => {
      const month = d.getMonth() + 1
      const day = d.getDate()
      const h = d.getHours().toString().padStart(2, '0')
      const m = d.getMinutes().toString().padStart(2, '0')
      return `${month}-${day} ${h}:${m}`
    }

    logisticsInfo.value = [
      { desc: '【收货地址】已签收，签收人：本人', time: formatTime(now) },
      { desc: '【派送中】您的包裹正在派送中，请您保持电话畅通', time: formatTime(new Date(now.getTime() - 3600000)) },
      { desc: '【运输中】快件已到达【北京分拨中心】', time: formatTime(new Date(now.getTime() - 7200000)) },
      { desc: '【运输中】快件已从【商家仓库】发出', time: formatTime(new Date(now.getTime() - 86400000)) },
      { desc: '【已发货】卖家正在通知快递公司揽件', time: formatTime(new Date(now.getTime() - 172800000)) }
    ]
    isLoading.value = false
  }, 1500)
}
</script>

<template>
  <div class="page">
    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-box">
        <input
          class="search-input"
          placeholder="请输入快递单号"
          :value="trackingNo"
          @input="onInput"
          @keyup.enter="queryExpress"
        />
        <span class="search-btn" @click="queryExpress">查询</span>
      </div>
      <div class="company-list">
        <div
          v-for="c in companies"
          :key="c.code"
          :class="['company-item', { active: selectedCompany === c.code }]"
          @click="selectCompany(c.code)"
        >
          <span class="company-icon">{{ c.icon }}</span>
          <span class="company-name">{{ c.name }}</span>
        </div>
      </div>
    </div>

    <!-- 查询按钮 -->
    <button class="query-btn" :disabled="!trackingNo" @click="queryExpress">
      🔍 查询快递
    </button>

    <!-- 物流信息 -->
    <div v-if="logisticsInfo.length > 0" class="result-section">
      <div class="result-header">
        <span class="result-title">物流信息</span>
        <span class="result-status shipping">运输中</span>
      </div>
      <div class="timeline">
        <div
          v-for="(item, index) in logisticsInfo"
          :key="index"
          :class="['timeline-item', { latest: index === 0 }]"
        >
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <span class="timeline-text">{{ item.desc }}</span>
            <span class="timeline-time">{{ item.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="showEmpty" class="empty-section">
      <span class="empty-icon">📦</span>
      <span class="empty-text">输入快递单号查询物流信息</span>
      <span class="empty-hint">支持顺丰、圆通、中通、韵达等主流快递</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-section">
      <span class="loading-icon">⏳</span>
      <span class="loading-text">正在查询...</span>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 16px;
}

.search-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: #667eea;
}

.search-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}

.company-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.company-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f5f5f5;
  cursor: pointer;
  flex-shrink: 0;
}

.company-item.active {
  background: #667eea;
  color: white;
}

.company-icon {
  font-size: 18px;
}

.company-name {
  font-size: 11px;
}

.query-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 12px;
}

.query-btn:disabled {
  opacity: 0.6;
}

.result-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.result-status {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
}

.result-status.shipping {
  background: #e3f2fd;
  color: #1976d2;
}

.timeline {
  position: relative;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding-bottom: 20px;
  position: relative;
}

.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: #e0e0e0;
}

.timeline-item.latest .timeline-dot {
  background: #667eea;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
  flex-shrink: 0;
  margin-top: 4px;
}

.timeline-content {
  display: flex;
  flex-direction: column;
}

.timeline-text {
  font-size: 14px;
  color: #333;
}

.timeline-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.empty-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 12px;
  color: #999;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.loading-icon {
  font-size: 40px;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: 14px;
  color: #666;
  margin-top: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
