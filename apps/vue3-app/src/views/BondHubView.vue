<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const actions = [
  {
    title: '可转债提醒设置',
    desc: '进入高级提醒页，配置上市、强赎、下修和中位数提醒。',
    icon: '🔔',
    path: '/save/remind-settings',
  },
  {
    title: '追涨策略',
    desc: '查看与可转债轮动相关的策略说明入口。',
    icon: '📈',
    path: '/save/chase-rise-strategy',
  },
]

function open(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-badge">韭零后小站的储钱助手</div>
      <h1 class="hero-title">转债神器</h1>
      <p class="hero-desc">这里作为转债功能入口，后续可以继续扩展转债列表、轮动和估值工具。</p>
    </header>

    <section class="card-list">
      <button
        v-for="action in actions"
        :key="action.path"
        type="button"
        class="action-card"
        @click="open(action.path)"
      >
        <span class="action-icon">{{ action.icon }}</span>
        <span class="action-title">{{ action.title }}</span>
        <span class="action-desc">{{ action.desc }}</span>
        <span class="action-arrow">进入 ›</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top, #f8fafc 0, #ffffff 42%),
    #ffffff;
}

.hero {
  padding: 6px 2px 16px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.hero-title {
  margin: 14px 0 6px;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.1;
}

.hero-desc {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.card-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 16px;
  border: 1px solid #e8edf3;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
  text-align: left;
  cursor: pointer;
}

.action-icon {
  font-size: 24px;
  line-height: 1;
}

.action-title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
}

.action-desc {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.action-arrow {
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
}

@media (min-width: 900px) {
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding-left: 18px;
    padding-right: 18px;
  }

  .card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
