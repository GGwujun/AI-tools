<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const title = computed(() => (route.query.title as string) || '功能建设中')
const desc = computed(() => (route.query.desc as string) || '这个入口已经预留，后续会继续补完整功能。')

function goBack() {
  router.push('/save')
}

function openReminderSettings() {
  router.push('/save/remind-settings')
}
</script>

<template>
  <div class="page">
    <div class="card">
      <span class="badge">韭零后小站的储钱助手</span>
      <h1 class="title">{{ title }}</h1>
      <p class="desc">{{ desc }}</p>
      <p class="hint">当前先保留为导航占位入口，后续可继续接真实页面或后端接口。</p>

      <div class="actions">
        <button type="button" class="primary" @click="goBack">返回导航页</button>
        <button type="button" class="secondary" @click="openReminderSettings">去高级提醒</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: calc(20px + env(safe-area-inset-top)) 14px calc(20px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, #fff4eb 0, #ffffff 36%),
    #ffffff;
}

.card {
  width: min(100%, 640px);
  padding: 18px;
  border: 1px solid #e8edf3;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.05);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  font-weight: 700;
}

.title {
  margin: 14px 0 8px;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.1;
}

.desc {
  margin: 0;
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
}

.hint {
  margin: 12px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.actions button {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary {
  border: 0;
  background: #2563eb;
  color: #fff;
}

.secondary {
  border: 1px solid #dbe3ef;
  background: #fff;
  color: #334155;
}
</style>
