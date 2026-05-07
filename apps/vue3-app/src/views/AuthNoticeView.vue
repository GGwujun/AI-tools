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
  router.replace('/save')
}

function openAgreement() {
  router.push('/save/user-agreement')
}

function openPrivacy() {
  router.push('/save/privacy-policy')
}
</script>

<template>
  <div class="page">
    <div class="panel">
      <button class="close" @click="closeNotice"></button>
      <div class="shield">
        <div class="shield-inner"></div>
      </div>
      <h1>温馨提示</h1>
      <p>
        本产品提供的内容基于历史数据、规则推演、公开信息与模型生成结果展示，仅供参考，不构成投资建议。
      </p>
      <div class="links">
        <span>我已阅读并同意</span>
        <button class="link-btn" @click="openAgreement">《用户协议》</button>
        <span>和</span>
        <button class="link-btn" @click="openPrivacy">《隐私政策》</button>
      </div>
      <button class="enter" @click="enterProduct">进入产品</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at top, #71dacd 0%, #2db09a 35%, #eff7fb 100%);
}

.panel {
  position: relative;
  width: min(100%, 360px);
  padding: 24px 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 80px rgba(16, 78, 70, 0.28);
  text-align: center;
}

.close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
}

.close::before,
.close::after {
  content: '';
  position: absolute;
  top: 13px;
  left: 7px;
  width: 14px;
  height: 2px;
  background: #5d7f86;
  border-radius: 2px;
}

.close::before {
  transform: rotate(45deg);
}

.close::after {
  transform: rotate(-45deg);
}

.shield {
  width: 140px;
  height: 140px;
  margin: 18px auto 16px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.15) 68%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.shield-inner {
  width: 72px;
  height: 82px;
  background: linear-gradient(180deg, #dff9f2 0%, #7fd8c6 100%);
  clip-path: polygon(50% 0, 88% 14%, 88% 54%, 50% 100%, 12% 54%, 12% 14%);
  position: relative;
}

.shield-inner::after {
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

h1 {
  font-size: 28px;
  margin-bottom: 10px;
  color: #24424b;
}

p {
  font-size: 13px;
  line-height: 1.8;
  color: #5f7389;
}

.links {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  color: #5f7389;
  line-height: 1.8;
}

.link-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: #10947d;
  font-size: 11px;
  font-weight: 700;
}

.enter {
  width: 100%;
  height: 48px;
  margin-top: 18px;
  border: 0;
  border-radius: 16px;
  background: linear-gradient(180deg, #16ac93 0%, #10947d 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}
</style>
