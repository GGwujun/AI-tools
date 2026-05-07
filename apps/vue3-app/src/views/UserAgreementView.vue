<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back()"></button>
      <div class="title">用户协议</div>
      <div></div>
    </header>

    <section class="card">
      <h1>用户协议</h1>
      <p>欢迎使用本产品。你在使用前应充分阅读本协议，并在理解相关风险后再继续使用。</p>
      <h2>1. 服务性质</h2>
      <p>本产品提供基金套利、可转债机会、历史统计、提醒设置等信息辅助服务，不提供自动下单、收益承诺或投资顾问服务。</p>
      <h2>2. 信息来源</h2>
      <p>页面内容基于历史数据、规则模型、公开信息与模型生成结果整理，仅供参考。你应自行判断信息的适用性与时效性。</p>
      <h2>3. 用户责任</h2>
      <p>你应对自己的浏览、收藏、提醒设置及后续投资决策负责。因依赖页面信息进行交易产生的风险与结果，由你自行承担。</p>
      <h2>4. 服务变更</h2>
      <p>我们可能根据产品迭代对页面、功能、提示方式或数据展示进行调整，无需逐项另行通知。</p>
      <h2>5. 风险提示</h2>
      <p>市场价格、溢价率、限额状态、强赎节奏等均可能快速变化。任何展示结论都不构成投资建议或收益保证。</p>
    </section>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 24px; background: var(--lof-bg); }
.topbar { display: grid; grid-template-columns: 18px 1fr 18px; align-items: center; margin-bottom: 14px; }
.title { text-align: center; font-size: 18px; font-weight: 700; }
.back { width: 18px; height: 18px; border: 0; background: none; position: relative; }
.back::before { content: ''; position: absolute; left: 2px; top: 7px; width: 10px; height: 10px; border-left: 2px solid #1f3348; border-bottom: 2px solid #1f3348; transform: rotate(45deg); }
.card { padding: 18px 16px; border-radius: 22px; background: #fff; box-shadow: var(--lof-shadow); }
.card h1 { font-size: 22px; color: #1d3042; }
.card h2 { margin-top: 18px; font-size: 15px; color: #1d3042; }
.card p { margin-top: 8px; font-size: 13px; line-height: 1.8; color: #5f7389; }
</style>
