<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back()"></button>
      <div class="title">隐私政策</div>
      <div></div>
    </header>

    <section class="card">
      <h1>隐私政策</h1>
      <p>我们重视你的隐私。本页面用于说明在当前产品演示与提醒场景下，可能涉及的数据使用范围与处理方式。</p>
      <h2>1. 可能使用的信息</h2>
      <p>为支持设备识别、提醒偏好、自选列表与页面状态保存，系统可能使用设备标识、页面设置项与本地存储信息。</p>
      <h2>2. 使用目的</h2>
      <p>相关信息仅用于维持登录态、同步提醒配置、展示自选状态、保存已阅读提示等产品功能，不用于收益评估或个人征信场景。</p>
      <h2>3. 信息展示边界</h2>
      <p>产品中的机会、统计、提醒与 AI 解读内容为信息辅助展示，不会替你做投资决策，也不会自动触发真实交易操作。</p>
      <h2>4. 存储与控制</h2>
      <p>你可以通过退出登录、关闭提醒、清理本地数据等方式减少或重置相关状态信息。不同版本中可管理项可能随功能迭代调整。</p>
      <h2>5. 风险说明</h2>
      <p>请勿在本产品中输入与本服务无关的敏感信息。若你继续使用相关功能，视为理解并接受本政策说明。</p>
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
