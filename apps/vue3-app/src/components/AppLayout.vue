<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useLofH5Store } from '@/stores/lofH5'

const route = useRoute()
const router = useRouter()
const lofStore = useLofH5Store()

const showTabBar = computed(() => route.meta.hideTabBar !== true)
const showNotice = computed(() => !lofStore.acceptedNotice && route.name !== 'save-warm-notice')
const activeTab = computed(() => {
  const metaTab = route.meta.tab as string | undefined
  if (metaTab === 'watchlist' || metaTab === 'mine') return metaTab
  return lofStore.homeCategory === 'etf' ? 'etf' : 'home'
})

const tabs = [
  { key: 'home', name: '首页', icon: 'home' },
  { key: 'etf', name: 'ETF', icon: 'chart' },
  { key: 'watchlist', name: '自选', icon: 'star' },
  { key: 'mine', name: '我的', icon: 'user' },
] as const

function navigateTo(key: (typeof tabs)[number]['key']) {
  if (key === 'home') {
    lofStore.setHomeCategory('stock_lof')
    router.push('/')
    return
  }

  if (key === 'etf') {
    lofStore.setHomeCategory('etf')
    router.push('/')
    return
  }

  if (key === 'watchlist') {
    router.push('/watchlist')
    return
  }

  router.push('/mine')
}

const acceptNotice = () => lofStore.setAcceptedNotice(true)
const openFullNotice = () => router.push('/save/warm-notice')
</script>

<template>
  <div class="layout">
    <div :class="['content', { 'with-tab-bar': showTabBar }]">
      <RouterView />
    </div>

    <div v-if="showNotice" class="notice-mask">
      <div class="notice-panel">
        <h3>免责声明</h3>
        <p>所有数据来源于公开接口，估算净值可能存在滞后，仅供参考，不构成投资建议。</p>
        <div class="notice-actions">
          <button class="secondary-btn" @click="openFullNotice">查看详情</button>
          <button class="primary-btn" @click="acceptNotice">我已知晓</button>
        </div>
      </div>
    </div>

    <nav v-if="showTabBar" class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-item', { active: activeTab === tab.key }]"
        @click="navigateTo(tab.key)"
      >
        <span :class="['tab-icon', `tab-icon-${tab.icon}`]"></span>
        <span class="tab-text">{{ tab.name }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: var(--lof-bg);
}

.content.with-tab-bar {
  padding-bottom: calc(104px + env(safe-area-inset-bottom));
}

.notice-mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  z-index: 140;
}

.notice-panel {
  width: min(100%, 430px);
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: #242b3d;
  border: 1px solid rgba(234, 236, 240, 0.08);
  box-shadow: var(--lof-shadow);
}

.notice-panel h3 {
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
  color: var(--lof-text);
}

.notice-panel p {
  margin-top: 10px;
  color: var(--lof-muted);
  font-size: 13px;
  line-height: 20px;
}

.notice-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

.primary-btn,
.secondary-btn {
  min-height: 44px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn {
  border: 0;
  background: var(--lof-link);
  color: #fff;
}

.secondary-btn {
  border: 1px solid rgba(234, 236, 240, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--lof-text);
}

.tab-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, 100vw);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  background: rgba(22, 26, 35, 0.96);
  border-top: 1px solid rgba(234, 236, 240, 0.08);
  backdrop-filter: blur(16px);
  z-index: 120;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  background: none;
  color: #77819a;
}

.tab-item.active {
  color: var(--lof-text);
}

.tab-text {
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
}

.tab-icon {
  position: relative;
  width: 22px;
  height: 22px;
  color: currentColor;
}

.tab-icon-home::before {
  content: '';
  position: absolute;
  inset: 7px 4px 3px;
  border: 1.8px solid currentColor;
  border-top: 0;
  border-radius: 0 0 4px 4px;
}

.tab-icon-home::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: 2px;
  height: 9px;
  border-top: 1.8px solid currentColor;
  border-left: 1.8px solid currentColor;
  border-right: 1.8px solid currentColor;
  transform: skewY(-28deg);
}

.tab-icon-chart::before,
.tab-icon-chart::after {
  content: '';
  position: absolute;
  bottom: 3px;
  border-radius: 999px;
  background: currentColor;
}

.tab-icon-chart::before {
  left: 4px;
  width: 4px;
  height: 10px;
  box-shadow: 6px -4px 0 currentColor, 12px -1px 0 currentColor;
}

.tab-icon-chart::after {
  left: 3px;
  right: 3px;
  bottom: 2px;
  height: 1.8px;
  opacity: 0.55;
}

.tab-icon-star {
  clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 72%, 21% 92%, 32% 57%, 2% 35%, 39% 35%);
  background: currentColor;
}

.tab-icon-user {
  border: 1.8px solid currentColor;
  border-radius: 999px;
}

.tab-icon-user::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 3px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.tab-icon-user::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 3px;
  height: 6px;
  border-radius: 999px 999px 4px 4px;
  background: currentColor;
}
</style>
