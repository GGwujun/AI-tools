import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/save' },
    { path: '/save', name: 'save', component: () => import('../views/SaveHubView.vue'), meta: { tab: 'opportunity' } },
    { path: '/watchlist', name: 'watchlist', component: () => import('../views/WatchlistView.vue'), meta: { tab: 'watchlist', requiresAuth: true } },
    { path: '/calendar', name: 'calendar', component: () => import('../views/ReminderCalendarView.vue'), meta: { tab: 'calendar', requiresAuth: true } },
    { path: '/mine', name: 'mine', component: () => import('../views/AboutView.vue'), meta: { tab: 'mine' } },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { hideTabBar: true } },
    { path: '/about', redirect: '/mine' },
    { path: '/ai', name: 'ai', component: () => import('../views/AIView.vue') },
    { path: '/ai/video-parse', name: 'video-parse', component: () => import('../views/VideoParseView.vue') },
    { path: '/ai/writer', name: 'writer', component: () => import('../views/WriterView.vue') },
    { path: '/ai/ocr', name: 'ocr', component: () => import('../views/OcrView.vue') },
    { path: '/ai/eraser', name: 'eraser', component: () => import('../views/EraserView.vue') },
    { path: '/ai/tts', name: 'tts', component: () => import('../views/TtsView.vue') },
    { path: '/video', name: 'video', component: () => import('../views/VideoView.vue') },
    { path: '/kj', name: 'kj', component: () => import('../views/KjView.vue') },
    { path: '/tools/currency', name: 'currency', component: () => import('../views/CurrencyView.vue') },
    { path: '/tools/qrcode', name: 'qrcode', component: () => import('../views/QrcodeView.vue') },
    { path: '/tools/express', name: 'express', component: () => import('../views/ExpressView.vue') },
    { path: '/tools/translator', name: 'translator', component: () => import('../views/TranslatorView.vue') },
    { path: '/tools/converter', name: 'converter', component: () => import('../views/ConverterView.vue') },
    { path: '/tools/decision', name: 'decision', component: () => import('../views/DecisionView.vue') },
    { path: '/save/switch', name: 'switch', component: () => import('../views/SwitchView.vue'), meta: { tab: 'mine', requiresAuth: true } },
    { path: '/save/remind-settings', name: 'remind-settings', component: () => import('../views/RemindSettingsView.vue'), meta: { tab: 'mine', requiresAuth: true } },
    { path: '/save/arbitrage', name: 'arbitrage', component: () => import('../views/SaveView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/arbitrage-guide', name: 'arbitrage-guide', component: () => import('../views/ArbitrageView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/bond-subscribe', name: 'bond-subscribe', component: () => import('../views/BondSubscribeView.vue'), meta: { tab: 'calendar' } },
    { path: '/save/bond-lottery', name: 'bond-lottery', component: () => import('../views/BondLotteryView.vue'), meta: { tab: 'calendar' } },
    { path: '/save/bond-rotation', name: 'bond-rotation', redirect: '/save/bond-detail/core', meta: { tab: 'watchlist' } },
    { path: '/save/feature/:featureId', name: 'save-feature', component: () => import('../views/SaveFeaturePlaceholderView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/fund-detail', name: 'fund-detail', redirect: '/save/fund-detail/core', meta: { tab: 'opportunity' } },
    { path: '/save/fund-detail/core', name: 'fund-detail-core', component: () => import('../views/FundDetailView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/fund-detail/realtime', name: 'fund-detail-realtime', component: () => import('../views/FundDetailView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/fund-detail/strategy', name: 'fund-detail-strategy', component: () => import('../views/FundDetailView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/fund-detail/history', name: 'fund-detail-history', component: () => import('../views/FundDetailView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/bond-detail/core', name: 'bond-detail-core', component: () => import('../views/BondRotationStrategyView.vue'), meta: { tab: 'watchlist' } },
    { path: '/save/bond-detail/risk', name: 'bond-detail-risk', component: () => import('../views/BondRotationStrategyView.vue'), meta: { tab: 'watchlist' } },
    { path: '/save/chase-rise-strategy', name: 'chase-rise-strategy', component: () => import('../views/ChaseRiseStrategyView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/filter', name: 'save-filter', component: () => import('../views/FilterConditionsView.vue'), meta: { tab: 'opportunity', hideTabBar: true } },
    { path: '/save/ai-analysis', name: 'save-ai-analysis', component: () => import('../views/AIView.vue'), meta: { tab: 'opportunity' } },
    { path: '/save/warm-notice', name: 'save-warm-notice', component: () => import('../views/AuthNoticeView.vue'), meta: { hideTabBar: true } },
    { path: '/save/user-agreement', name: 'save-user-agreement', component: () => import('../views/UserAgreementView.vue'), meta: { hideTabBar: true } },
    { path: '/save/privacy-policy', name: 'save-privacy-policy', component: () => import('../views/PrivacyPolicyView.vue'), meta: { hideTabBar: true } },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth !== true) return true

  const authStore = useAuthStore()
  if (authStore.isLoggedIn) return true

  return {
    path: '/login',
    query: {
      redirect: to.fullPath,
    },
  }
})

export default router
