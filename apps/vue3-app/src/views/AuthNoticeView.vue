<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useLofH5Store } from '@/stores/lofH5'

const router = useRouter()
const lofStore = useLofH5Store()

function closeNotice() {
  router.back()
}

function enterProduct() {
  lofStore.setAcceptedNotice(true)
  router.replace('/')
}
</script>

<template>
  <div class="page">
    <section class="panel">
      <button class="close-btn" @click="closeNotice">×</button>
      <div class="badge-ring">
        <div class="shield"></div>
      </div>
      <span class="kicker">使用边界说明</span>
      <h1>风险说明</h1>
      <p>页面内容基于历史数据、规则模型、公开信息与模型生成结果整理，仅供参考，不构成投资建议。你需要自行判断信息是否适用于当前市场环境。</p>
      <div class="bullet-list">
        <div class="bullet-item">净值估算可能存在时差，盘中更适合做观察，不适合作为唯一决策依据。</div>
        <div class="bullet-item">限额、暂停申购、到账节奏等信息，仍需以基金公告和券商规则为准。</div>
      </div>
      <div class="agreement">
        <span>继续使用即表示你已阅读相关说明</span>
        <div class="links">
          <button @click="router.push('/save/user-agreement')">用户协议</button>
          <button @click="router.push('/save/privacy-policy')">隐私政策</button>
        </div>
      </div>
      <button class="primary-btn" @click="enterProduct">我已知晓并继续</button>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(74, 144, 226, 0.18), transparent 34%),
    #1a1e2b;
}
.panel {
  position: relative;
  width: min(100%, 388px);
  padding: 28px 24px;
  border-radius: 24px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02)),
    rgba(36, 43, 61, 0.96);
  box-shadow: var(--lof-shadow);
  text-align: center;
}
.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  color: var(--lof-muted);
  font-size: 20px;
}
.badge-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124px;
  height: 124px;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 144, 226, 0.10), rgba(74, 144, 226, 0.02));
}
.shield {
  width: 70px;
  height: 80px;
  background: linear-gradient(180deg, #dbe9ff 0%, #6aa5f2 100%);
  clip-path: polygon(50% 0, 88% 14%, 88% 54%, 50% 100%, 12% 54%, 12% 14%);
  position: relative;
}
.shield::after {
  content: '';
  position: absolute;
  left: 22px;
  top: 34px;
  width: 24px;
  height: 12px;
  border-left: 4px solid #fff;
  border-bottom: 4px solid #fff;
  transform: rotate(-45deg);
}
.kicker {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(74, 144, 226, 0.12);
  color: #c8ddff;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
h1 {
  margin-top: 10px;
  color: var(--lof-text);
  font-size: 28px;
  line-height: 34px;
  font-weight: 800;
}
p,
.agreement span,
.bullet-item {
  margin-top: 12px;
  color: var(--lof-muted);
  font-size: 13px;
  line-height: 21px;
}
.bullet-list {
  margin-top: 16px;
  text-align: left;
}
.bullet-item {
  position: relative;
  padding-left: 16px;
  margin-top: 8px;
}
.bullet-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(74, 144, 226, 0.8);
}
.agreement {
  margin-top: 18px;
}
.links {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
}
.links button {
  border: 0;
  background: transparent;
  color: var(--lof-link);
  font-size: 12px;
  font-weight: 700;
}
.primary-btn {
  width: 100%;
  min-height: 48px;
  margin-top: 20px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(90deg, #2d6bc4 0%, #4a90e2 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}
</style>
