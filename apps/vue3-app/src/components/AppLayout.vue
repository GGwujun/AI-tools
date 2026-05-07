<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useLofH5Store } from '@/stores/lofH5'

const route = useRoute()
const router = useRouter()
const lofStore = useLofH5Store()

const activeTab = computed(() => (route.meta.tab as string) || 'opportunity')
const showTabBar = computed(() => route.meta.hideTabBar !== true)
const showNotice = computed(() => !lofStore.acceptedNotice && route.name !== 'save-warm-notice')

const tabs = [
  { key: 'opportunity', name: '机会', path: '/save', icon: 'home' },
  { key: 'watchlist', name: '自选', path: '/watchlist', icon: 'star' },
  { key: 'mine', name: '我的', path: '/mine', icon: 'user' },
]

const navigateTo = (path: string) => router.push(path)
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
        <h3>温馨提示</h3>
        <p>以下内容基于历史数据、规则模型、公开信息与模型生成结果整理，仅供参考，不构成投资建议。</p>
        <div class="notice-actions">
          <button class="secondary-btn" @click="openFullNotice">查看详情</button>
          <button class="primary-btn" @click="acceptNotice">我已知晓并继续</button>
        </div>
      </div>
    </div>
    <div v-if="showTabBar" class="tab-bar">
      <div v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: activeTab === tab.key }" @click="navigateTo(tab.path)">
        <span :class="['tab-icon', `tab-icon-${tab.icon}`]"></span>
        <span class="tab-text">{{ tab.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; display: flex; flex-direction: column; background: var(--lof-bg); }
.content { flex: 1; }
.content.with-tab-bar { padding-bottom: 86px; }
.notice-mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.28);
  z-index: 120;
}
.notice-panel {
  width: min(100%, 360px);
  padding: 22px 18px;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.2);
}
.notice-panel h3 { font-size: 22px; font-weight: 700; text-align: center; }
.notice-panel p { margin-top: 12px; font-size: 13px; line-height: 1.8; color: #5f7389; text-align: center; }
.notice-actions { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 18px; }
.primary-btn, .secondary-btn { height: 44px; border-radius: 14px; font-size: 14px; }
.primary-btn { border: 0; background: linear-gradient(180deg, #16ac93 0%, #10947d 100%); color: #fff; font-weight: 700; }
.secondary-btn { border: 1px solid var(--lof-border); background: #fff; color: #44566c; }
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  z-index: 100;
}
.tab-item { display: flex; width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 5px; color: #9aa7b8; }
.tab-item.active { color: var(--lof-primary); }
.tab-text { font-size: 11px; font-weight: 600; }
.tab-icon { width: 22px; height: 22px; position: relative; color: currentColor; }
.tab-icon-home::before { content: ''; position: absolute; inset: 6px 3px 2px; border: 1.8px solid currentColor; border-top: 0; border-radius: 0 0 4px 4px; }
.tab-icon-home::after { content: ''; position: absolute; left: 2px; right: 2px; top: 1px; height: 12px; border-left: 1.8px solid currentColor; border-top: 1.8px solid currentColor; border-right: 1.8px solid currentColor; transform: rotate(45deg) scale(.62); border-radius: 2px; }
.tab-icon-star { clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 72%, 21% 92%, 32% 57%, 2% 35%, 39% 35%); background: currentColor; }
.tab-icon-user { border: 1.8px solid currentColor; border-radius: 999px; }
.tab-icon-user::before { content: ''; position: absolute; left: 6px; top: 3px; width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
.tab-icon-user::after { content: ''; position: absolute; left: 4px; right: 4px; bottom: 3px; height: 6px; border-radius: 999px 999px 4px 4px; background: currentColor; }
</style>
