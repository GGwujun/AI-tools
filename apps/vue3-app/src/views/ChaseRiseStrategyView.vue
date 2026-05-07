<script setup lang="ts">
// Chase Rise Strategy View - 追涨策略页面
</script>

<template>
  <div class="page">
    <!-- 固定头部 -->
    <div class="fixed-header">
      <div class="header-top">
        <span class="header-title">波动很大，不构成任何投资建议！</span>
        <div class="header-brand">
          <span class="brand-icon">💰</span>
          <span class="brand-text">韭零后小站的储钱助手</span>
        </div>
      </div>
      <div class="notice-bar">
        <span class="notice-icon">📢</span>
        <span class="notice-text">数据仅供参考，不构成任何投资建议，不承担任何结果！</span>
      </div>
    </div>

    <div class="content">
      <!-- 免责声明 -->
      <div class="disclaimer-section">
        <span class="disclaimer-text">数据仅供参考，不构成任何投资建议，不承担任何投资结果！</span>
      </div>

      <!-- 追涨策略简介 -->
      <div class="card">
        <span class="section-title">追涨策略简介</span>

        <div class="info-row">
          <span class="info-label-yellow">理论基础：</span>
          <span class="info-content">基于市场的不可预测性和趋势一旦形成通常不会马上结束。</span>
        </div>

        <div class="info-row">
          <span class="info-label-yellow">策略基础：</span>
          <span class="info-content">在A股、美股、商品等标的中选出区间趋势最强的两只，然后等权平均持有。</span>
        </div>

        <div class="info-row">
          <span class="info-label-yellow">策略优势：</span>
          <span class="info-content">在趋势行情中，冲劲最猛，而且有策略傍身，更能拿得住。</span>
        </div>

        <div class="info-row">
          <span class="info-label-yellow">策略劣势：</span>
          <span class="info-content-green">在震荡行情中，趋势不明朗，会反复轮动，反复吃面。</span>
        </div>

        <div class="quote-section">
          <span class="quote-text">个人觉得最好的策略，必须要知道什么时候卖出！</span>
          <span class="quote-text">会买的是徒弟，会卖的才是师傅！</span>
        </div>
      </div>

      <!-- 策略图表 -->
      <div class="card chart-card">
        <div class="chart-placeholder">
          <span class="chart-text">📊 追涨策略走势图</span>
          <span class="chart-subtext">（此处展示策略历史表现图表）</span>
        </div>
      </div>

      <!-- 公众号三大策略汇总 -->
      <div class="card">
        <span class="section-title">公众号上三大策略汇总</span>

        <div class="strategy-item">
          <span class="strategy-label">套利策略：</span>
          <span class="strategy-desc">最稳，但资金容量较小，适合小资金。</span>
        </div>

        <div class="strategy-item">
          <span class="strategy-label">可转债轮动策略：</span>
          <span class="strategy-desc">中风险，中收益，下有底，上无限。</span>
        </div>

        <div class="strategy-item">
          <span class="strategy-label">追涨策略：</span>
          <span class="strategy-desc">高风险，高收益，适合长期严格执行。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.fixed-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.header-title {
  font-size: 14px;
  opacity: 0.9;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 4px;
}

.brand-icon {
  font-size: 16px;
}

.brand-text {
  font-size: 12px;
}

.notice-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 8px;
}

.notice-icon {
  font-size: 14px;
}

.notice-text {
  font-size: 12px;
}

.content {
  padding: 16px;
}

.disclaimer-section {
  background: #fff3e0;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.disclaimer-text {
  font-size: 12px;
  color: #ff9800;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12px;
}

.info-row {
  margin-bottom: 12px;
}

.info-label-yellow {
  font-size: 14px;
  font-weight: 600;
  color: #ff9800;
}

.info-content {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.info-content-green {
  font-size: 14px;
  color: #4caf50;
  line-height: 1.6;
}

.quote-section {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 8px;
  margin-top: 12px;
}

.quote-text {
  font-size: 14px;
  color: #333;
  display: block;
  font-style: italic;
}

.quote-text:last-child {
  margin-top: 8px;
}

.chart-card {
  text-align: center;
}

.chart-placeholder {
  padding: 40px;
}

.chart-text {
  font-size: 18px;
  display: block;
}

.chart-subtext {
  font-size: 12px;
  color: #999;
  display: block;
  margin-top: 8px;
}

.strategy-item {
  margin-bottom: 12px;
}

.strategy-label {
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
}

.strategy-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}
</style>
