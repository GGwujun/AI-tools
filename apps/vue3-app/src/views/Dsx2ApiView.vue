<script setup lang="ts">
import { ref } from 'vue'

const activeVendor = ref('openai')

const vendors = [
  { id: 'openai', name: 'OpenAI', icon: '🤖' },
  { id: 'claude', name: 'Claude', icon: '🧠' },
  { id: 'zhipu', name: '智谱', icon: '🔮' },
  { id: 'kimi', name: 'Kimi', icon: '🌙' },
  { id: 'deepseek', name: 'DeepSeek', icon: '⚡' }
]

const vendorInfo: Record<string, { models: string, tokenPrices: { name: string, price: string, tokens: string }[], datePlans: { name: string, price: string, unit: string }[] }> = {
  openai: {
    models: 'GPT-4o / GPT-4o-mini / o1',
    tokenPrices: [
      { name: '入门', price: '9', tokens: '500万' },
      { name: '标准', price: '16', tokens: '1000万' },
      { name: '超值', price: '28', tokens: '2000万' },
      { name: '旗舰', price: '59', tokens: '5000万' }
    ],
    datePlans: [
      { name: '天卡', price: '19', unit: '/天' },
      { name: '周卡', price: '69', unit: '/周' },
      { name: '月卡', price: '199', unit: '/月' }
    ]
  },
  claude: {
    models: 'Claude Opus / Sonnet / Haiku',
    tokenPrices: [
      { name: '入门', price: '12', tokens: '500万' },
      { name: '标准', price: '22', tokens: '1000万' },
      { name: '超值', price: '38', tokens: '2000万' },
      { name: '旗舰', price: '79', tokens: '5000万' }
    ],
    datePlans: [
      { name: '天卡', price: '29', unit: '/天' },
      { name: '周卡', price: '99', unit: '/周' },
      { name: '月卡', price: '269', unit: '/月' }
    ]
  },
  zhipu: {
    models: 'GLM-4 / GLM-4V / GLM-4-Flash',
    tokenPrices: [
      { name: '入门', price: '6', tokens: '500万' },
      { name: '标准', price: '10', tokens: '1000万' },
      { name: '超值', price: '18', tokens: '2000万' },
      { name: '旗舰', price: '38', tokens: '5000万' }
    ],
    datePlans: [
      { name: '天卡', price: '9', unit: '/天' },
      { name: '周卡', price: '39', unit: '/周' },
      { name: '月卡', price: '99', unit: '/月' }
    ]
  },
  kimi: {
    models: 'Moonshot-v1 8k/32k/128k',
    tokenPrices: [
      { name: '入门', price: '7', tokens: '500万' },
      { name: '标准', price: '12', tokens: '1000万' },
      { name: '超值', price: '20', tokens: '2000万' },
      { name: '旗舰', price: '42', tokens: '5000万' }
    ],
    datePlans: [
      { name: '天卡', price: '9', unit: '/天' },
      { name: '周卡', price: '39', unit: '/周' },
      { name: '月卡', price: '99', unit: '/月' }
    ]
  },
  deepseek: {
    models: 'DeepSeek V3 / DeepSeek R1',
    tokenPrices: [
      { name: '入门', price: '6', tokens: '500万' },
      { name: '标准', price: '10', tokens: '1000万' },
      { name: '超值', price: '17', tokens: '2000万' },
      { name: '旗舰', price: '36', tokens: '5000万' }
    ],
    datePlans: [
      { name: '天卡', price: '9', unit: '/天' },
      { name: '周卡', price: '35', unit: '/周' },
      { name: '月卡', price: '89', unit: '/月' }
    ]
  }
}

const comparisonData = [
  { model: 'GPT-4o', offIn: '¥36', ourIn: '¥11', save: '70%' },
  { model: 'GPT-4o mini', offIn: '¥1.1', ourIn: '¥0.3', save: '73%' },
  { model: 'Claude 3.5 Sonnet', offIn: '¥21.6', ourIn: '¥6.5', save: '70%' },
  { model: 'DeepSeek V3', offIn: '¥1.0', ourIn: '¥0.4', save: '60%' }
]

const features = [
  { icon: '⚡', title: '超低延迟', desc: '国内优化线路，平均响应 < 500ms' },
  { icon: '🔒', title: '稳定可靠', desc: '多节点部署，99.9% 可用率' },
  { icon: '💰', title: '价格实惠', desc: '低至官方3折，额度永不过期' },
  { icon: '🔌', title: '即插即用', desc: '改一行 baseURL 即可接入' }
]

const faqs = [
  { q: '什么是 API 中转服务？', a: '中转服务在您和AI官方接口之间架设代理，无需海外账号，直接通过国内节点调用官方模型。', open: false },
  { q: '接入是否复杂？', a: '非常简单。将 baseURL 改为我们的地址，填入 API Key，其余代码不用改动。', open: false },
  { q: '额度会过期吗？', a: '不会。Token 额度永久有效，不设到期日。', open: false },
  { q: '支持哪些付款方式？', a: '支持微信、支付宝付款。', open: false }
]

const toggleFaq = (index: number) => {
  const faq = faqs[index]
  if (faq) {
    faq.open = !faq.open
  }
}
</script>

<template>
  <div class="page">
    <!-- 顶部标题 -->
    <div class="header">
      <div class="header-badge">🔌 API中转服务</div>
      <h1 class="header-title">一站访问<br/>全球顶尖AI模型</h1>
      <p class="header-desc">
        GPT-4o、Claude 3.5、Gemini 等主流模型<br/>
        价格低至官方 <span class="highlight">3折</span>，兼容 OpenAI 接口
      </p>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-num">20+</span>
          <span class="stat-label">支持模型</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num">99.9%</span>
          <span class="stat-label">可用率</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num">3折起</span>
          <span class="stat-label">对比官方</span>
        </div>
      </div>
    </div>

    <div class="content">
      <!-- 价格对比 -->
      <div class="section">
        <div class="section-title">📊 价格对比（每百万Token）</div>
        <div class="comparison-list">
          <div v-for="item in comparisonData" :key="item.model" class="comparison-item">
            <div class="comparison-model">{{ item.model }}</div>
            <div class="comparison-prices">
              <span class="price-off">官方: {{ item.offIn }}</span>
              <span class="price-our">中转: {{ item.ourIn }}</span>
              <span class="price-save">省 {{ item.save }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 支持的模型 -->
      <div class="section">
        <div class="section-title">🤖 支持的模型</div>
        <div class="vendor-tabs">
          <div
            v-for="v in vendors"
            :key="v.id"
            :class="['vendor-tab', { active: activeVendor === v.id }]"
            @click="activeVendor = v.id"
          >
            <span>{{ v.icon }}</span>
            <span>{{ v.name }}</span>
          </div>
        </div>
        <div class="vendor-models">
          {{ vendorInfo[activeVendor]?.models }}
        </div>
      </div>

      <!-- Token套餐 -->
      <div class="section">
        <div class="section-title">🪙 Token充值套餐</div>
        <div class="token-plans">
          <div
            v-for="(plan, index) in vendorInfo[activeVendor]?.tokenPrices"
            :key="index"
            :class="['token-plan', { featured: index === 2 }]"
          >
            <div v-if="index === 2" class="plan-badge">最划算</div>
            <div class="plan-name">{{ plan.name }}</div>
            <div class="plan-price">¥{{ plan.price }}</div>
            <div class="plan-tokens">{{ plan.tokens }} Token</div>
          </div>
        </div>
      </div>

      <!-- 时间卡套餐 -->
      <div class="section">
        <div class="section-title">📅 时间卡套餐（不限量）</div>
        <div class="date-plans">
          <div
            v-for="plan in vendorInfo[activeVendor]?.datePlans"
            :key="plan.name"
            class="date-plan"
          >
            <div class="date-plan-name">{{ plan.name }}</div>
            <div class="date-plan-price">¥{{ plan.price }}</div>
            <div class="date-plan-unit">{{ plan.unit }}</div>
          </div>
        </div>
      </div>

      <!-- 功能特点 -->
      <div class="section">
        <div class="section-title">✨ 为什么选择我们</div>
        <div class="features-grid">
          <div v-for="f in features" :key="f.title" class="feature-item">
            <span class="feature-icon">{{ f.icon }}</span>
            <div class="feature-info">
              <span class="feature-title">{{ f.title }}</span>
              <span class="feature-desc">{{ f.desc }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 常见问题 -->
      <div class="section">
        <div class="section-title">❓ 常见问题</div>
        <div class="faq-list">
          <div
            v-for="(item, index) in faqs"
            :key="index"
            class="faq-item"
          >
            <div class="faq-question" @click="toggleFaq(index)">
              <span>{{ item.q }}</span>
              <span :class="['faq-toggle', { open: item.open }]">+</span>
            </div>
            <div v-if="item.open" class="faq-answer">{{ item.a }}</div>
          </div>
        </div>
      </div>

      <!-- 底部CTA -->
      <div class="cta-section">
        <div class="cta-title">开始使用</div>
        <div class="cta-desc">微信/支付宝付款，改一行代码即可接入</div>
        <div class="cta-hint">底部的联系方式找到我们</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0F0F1A 0%, #1a1a2e 100%);
  color: white;
}

.header {
  padding: 24px 16px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.header-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.3);
  font-size: 12px;
  color: #a78bfa;
  margin-bottom: 16px;
}

.header-title {
  font-size: 28px;
  font-weight: bold;
  line-height: 1.3;
  margin-bottom: 12px;
}

.header-desc {
  font-size: 14px;
  color: #9ca3af;
  line-height: 1.6;
  margin-bottom: 20px;
}

.header-desc .highlight {
  color: #a78bfa;
  font-weight: 600;
}

.header-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-top: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.stat-label {
  font-size: 10px;
  color: #6b7280;
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
}

.content {
  padding: 0 16px 32px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.comparison-list {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

.comparison-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.comparison-item:last-child {
  border-bottom: none;
}

.comparison-model {
  font-size: 14px;
  font-weight: 500;
}

.comparison-prices {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.price-off {
  color: #6b7280;
}

.price-our {
  color: #a78bfa;
  font-weight: 500;
}

.price-save {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.vendor-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}

.vendor-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.vendor-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
}

.vendor-models {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.token-plans {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.token-plan {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.token-plan.featured {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
}

.plan-badge {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 9px;
  white-space: nowrap;
}

.plan-name {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.plan-price {
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.plan-tokens {
  font-size: 9px;
  color: #a78bfa;
  margin-top: 2px;
}

.date-plans {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.date-plan {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
}

.date-plan-name {
  font-size: 12px;
  color: #93c5fd;
  margin-bottom: 4px;
}

.date-plan-price {
  font-size: 20px;
  font-weight: bold;
  color: white;
}

.date-plan-unit {
  font-size: 10px;
  color: #6b7280;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.feature-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.feature-info {
  display: flex;
  flex-direction: column;
}

.feature-title {
  font-size: 13px;
  font-weight: 600;
  color: white;
}

.feature-desc {
  font-size: 10px;
  color: #6b7280;
  margin-top: 2px;
  line-height: 1.4;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.faq-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 12px;
  font-size: 13px;
  cursor: pointer;
}

.faq-toggle {
  color: #6b7280;
  font-size: 18px;
  transition: transform 0.2s;
}

.faq-toggle.open {
  transform: rotate(45deg);
}

.faq-answer {
  padding: 0 12px 14px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.6;
}

.cta-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  margin-top: 24px;
}

.cta-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 8px;
}

.cta-desc {
  font-size: 13px;
  opacity: 0.9;
}

.cta-hint {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 8px;
}
</style>
