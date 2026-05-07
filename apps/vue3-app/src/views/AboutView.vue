<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveProfile, type SaveProfileResponse } from '@/lib/save-api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const deviceId = getDeviceId()
const loading = ref(false)
const error = ref('')
const response = ref<SaveProfileResponse | null>(null)
const mobileStatus = computed(() => {
  if (!authStore.isLoggedIn) return '未登录'
  return authStore.user?.mobile_bound ? `已绑定 ${authStore.user.mobile}` : '未绑定手机号'
})

const preferenceItems = [
  { key: 'risk', title: '风格偏好', note: '稳健 / 均衡 / 积极', path: '/save/switch' },
  { key: 'fund', title: '基金节奏偏好', note: '到账即卖 / 分批卖 / 续持观察', path: '/save/remind-settings' },
  { key: 'bond', title: '转债偏好', note: '双低 / 低溢价 / 强赎规避', path: '/save/remind-settings' },
  { key: 'alert', title: '提醒偏好', note: '买点 / 卖点 / 风险', path: '/save/remind-settings' },
] as const

const shortcutItems = [
  { key: 'watchlist', title: '我的自选', note: '统一查看基金和转债关注项', path: '/watchlist' },
  { key: 'reminders', title: '我的提醒', note: '查看提醒设置与触发偏好', path: '/save/remind-settings' },
  { key: 'records', title: '我的参与记录', note: '通过日历查看申购、到账与卖点节奏', path: '/calendar' },
  { key: 'guide', title: '新手教学', note: '查看套利课堂与入门说明', path: '/save/arbitrage-guide' },
] as const

const serviceItems = computed(() => [
  { key: 'switch', title: '提醒总开关', note: '统一管理基础提醒开关', path: '/save/switch' },
  { key: 'advanced', title: '高级提醒设置', note: '配置基金与转债的高级提醒类型', path: '/save/remind-settings' },
  { key: 'notice', title: '风险说明', note: '查看产品使用边界与风险提示', path: '/save/warm-notice' },
])

async function loadProfile() {
  loading.value = true
  error.value = ''
  try {
    response.value = await fetchSaveProfile(deviceId)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function open(path: string) {
  router.push(path)
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="page">
    <header class="profile">
      <div class="avatar"></div>
      <div class="info" v-if="authStore.isLoggedIn">
        <h1>{{ authStore.user?.nickname }}</h1>
        <p>{{ authStore.user?.level || response?.profile.level || '普通用户' }}</p>
      </div>
      <div class="info" v-else>
        <h1>未登录</h1>
        <p>登录后可同步自选、提醒与偏好设置</p>
      </div>
      <button v-if="authStore.isLoggedIn" class="member" @click="authStore.logout()">退出登录</button>
      <button v-else class="member" @click="router.push('/login')">去登录</button>
    </header>

    <section v-if="authStore.isLoggedIn" class="panel">
      <div class="section-head">
        <h2>账号状态</h2>
        <span>高级提醒依赖手机号身份</span>
      </div>
      <button class="service-item" @click="router.push('/login')">
        <div>
          <strong>手机号绑定状态</strong>
          <p>{{ mobileStatus }}</p>
        </div>
        <span class="arrow"></span>
      </button>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>偏好设置</h2>
        <span>按你的风格调整提醒与策略表达</span>
      </div>
      <div class="preference-list">
        <button
          v-for="item in preferenceItems"
          :key="item.key"
          class="preference-item"
          @click="open(item.path)"
        >
          <strong>{{ item.title }}</strong>
          <p>{{ item.note }}</p>
          <span class="arrow"></span>
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>我的工具</h2>
        <span>常用入口统一放在这里</span>
      </div>
      <div class="shortcut-list">
        <button
          v-for="item in shortcutItems"
          :key="item.key"
          class="shortcut-item"
          @click="open(item.path)"
        >
          <div>
            <strong>{{ item.title }}</strong>
            <p>{{ item.note }}</p>
          </div>
          <span class="arrow"></span>
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>设置与说明</h2>
        <span>保留当前有页面承接的功能</span>
      </div>
      <article v-if="error" class="service-item error-item">
        <div>
          <strong>{{ error }}</strong>
        </div>
      </article>
      <article v-else-if="loading" class="service-item">
        <div>
          <strong>正在加载我的页面...</strong>
        </div>
      </article>
      <button
        v-for="item in serviceItems"
        v-else
        :key="item.key"
        class="service-item"
        @click="open(item.path)"
      >
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.note }}</p>
        </div>
        <span class="arrow"></span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: calc(14px + env(safe-area-inset-top)) 16px 24px;
  background: var(--lof-bg);
}

.profile,
.panel {
  background: #fff;
  box-shadow: var(--lof-shadow);
  border-radius: 22px;
}

.profile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
}

.avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(180deg, #f1f4f8 0%, #dfe8f0 100%);
  position: relative;
}

.avatar::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #aab6c3;
}

.avatar::after {
  content: '';
  position: absolute;
  left: 11px;
  bottom: 8px;
  width: 32px;
  height: 16px;
  border-radius: 999px 999px 8px 8px;
  background: #aab6c3;
}

.info {
  flex: 1;
}

.info h1 {
  font-size: 20px;
}

.info p {
  margin-top: 4px;
  font-size: 12px;
  color: var(--lof-muted);
}

.member {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: #e8faf4;
  color: var(--lof-primary-deep);
  font-size: 12px;
  font-weight: 700;
}

.panel {
  margin-top: 14px;
  padding: 16px;
}

.section-head {
  margin-bottom: 12px;
}

.section-head h2 {
  font-size: 16px;
}

.section-head span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--lof-muted);
}

.preference-list,
.shortcut-list {
  display: grid;
  gap: 10px;
}

.preference-item,
.shortcut-item,
.service-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border: 0;
  border-bottom: 1px solid var(--lof-border);
  background: transparent;
  text-align: left;
}

.preference-item:first-child,
.shortcut-item:first-child,
.service-item:first-child {
  padding-top: 0;
}

.preference-item:last-child,
.shortcut-item:last-child,
.service-item:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.preference-item strong,
.shortcut-item strong,
.service-item strong {
  font-size: 14px;
  color: #1d3042;
}

.preference-item p,
.shortcut-item p,
.service-item p {
  margin-top: 4px;
  font-size: 12px;
  color: var(--lof-muted);
  line-height: 1.5;
}

.error-item strong {
  color: #c2410c;
}

.arrow {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-top: 2px solid #91a0af;
  border-right: 2px solid #91a0af;
  transform: rotate(45deg);
}
</style>
