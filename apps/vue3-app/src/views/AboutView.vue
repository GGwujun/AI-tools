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
  { key: 'risk', title: '风格偏好', note: '稳健 / 平衡 / 进取', path: '/save/switch' },
  { key: 'fund', title: '基金节奏偏好', note: '到账即看 / 分批处理 / 继续观察', path: '/save/remind-settings' },
  { key: 'bond', title: '转债偏好', note: '双低 / 低溢价 / 强赎规避', path: '/save/remind-settings' },
  { key: 'alert', title: '提醒偏好', note: '机会变化 / 卖点变化 / 风险变化', path: '/save/remind-settings' },
] as const

const shortcutItems = [
  { key: 'watchlist', title: '我的自选', note: '统一查看基金和转债关注项', path: '/watchlist' },
  { key: 'switch', title: '提醒总开关', note: '管理核心提醒能力', path: '/save/switch' },
  { key: 'notice', title: '风险说明', note: '查看使用边界与估值说明', path: '/save/warm-notice' },
] as const

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
    <section class="profile-card">
      <div class="avatar"></div>
      <div class="profile-copy">
        <h1>{{ authStore.isLoggedIn ? authStore.user?.nickname : '普通用户' }}</h1>
        <p>{{ authStore.isLoggedIn ? (authStore.user?.level || response?.profile.level || '已登录') : '登录后可同步自选、提醒与偏好设置' }}</p>
      </div>
      <button class="ghost-btn" @click="authStore.isLoggedIn ? authStore.logout() : router.push('/login')">
        {{ authStore.isLoggedIn ? '退出' : '登录' }}
      </button>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>账号状态</h2>
        <span>高级提醒依赖手机号身份</span>
      </div>
      <button class="row-btn" @click="router.push('/login')">
        <div>
          <strong>手机号绑定状态</strong>
          <p>{{ mobileStatus }}</p>
        </div>
        <span class="arrow">›</span>
      </button>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>偏好设置</h2>
        <span>按你的风格调整提醒与策略表达</span>
      </div>
      <button v-for="item in preferenceItems" :key="item.key" class="row-btn" @click="open(item.path)">
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.note }}</p>
        </div>
        <span class="arrow">›</span>
      </button>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>我的工具</h2>
      </div>
      <div v-if="error" class="state-line">{{ error }}</div>
      <div v-else-if="loading" class="state-line">正在加载我的页面...</div>
      <button v-for="item in shortcutItems" :key="item.key" class="row-btn" @click="open(item.path)">
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.note }}</p>
        </div>
        <span class="arrow">›</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) 16px calc(92px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, rgba(74, 144, 226, 0.14), transparent 32%),
    #1a1e2b;
}
.profile-card,
.panel {
  border-radius: 16px;
  border: 1px solid rgba(234, 236, 240, 0.08);
  background: rgba(36, 43, 61, 0.94);
  box-shadow: var(--lof-shadow);
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}
.avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(74, 144, 226, 0.85) 0%, rgba(45, 107, 196, 0.92) 100%);
  box-shadow: 0 8px 24px rgba(74, 144, 226, 0.24);
}
.profile-copy {
  flex: 1;
}
.profile-copy h1,
.panel h2,
.row-btn strong {
  color: var(--lof-text);
  font-weight: 700;
}
.profile-copy h1 {
  font-size: 20px;
  line-height: 28px;
}
.profile-copy p,
.panel-head span,
.row-btn p,
.state-line {
  color: var(--lof-muted);
  font-size: 12px;
  line-height: 18px;
}
.ghost-btn {
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: rgba(74, 144, 226, 0.16);
  color: var(--lof-link);
  font-size: 12px;
  font-weight: 700;
}
.panel {
  margin-top: 12px;
  padding: 16px;
}
.panel-head {
  margin-bottom: 8px;
}
.panel h2 {
  font-size: 16px;
  line-height: 24px;
}
.row-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border: 0;
  border-bottom: 1px solid rgba(234, 236, 240, 0.08);
  background: transparent;
  text-align: left;
}
.row-btn:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.arrow {
  color: #8d97aa;
  font-size: 18px;
}
.state-line {
  padding: 10px 0;
}
</style>
