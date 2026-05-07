<script setup lang="ts">
import { ref, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()

const greeting = ref('你好')
const date = ref('')

const greetingMap: Record<string, string> = {
  morning: '早上好',
  noon: '中午好',
  afternoon: '下午好',
  evening: '晚上好',
  night: '夜深了'
}

const initGreeting = () => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) greeting.value = greetingMap.morning!
  else if (hour >= 12 && hour < 14) greeting.value = greetingMap.noon!
  else if (hour >= 14 && hour < 18) greeting.value = greetingMap.afternoon!
  else if (hour >= 18 && hour < 22) greeting.value = greetingMap.evening!
  else greeting.value = greetingMap.night!

  const now = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  date.value = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
}

const tools = [
  { path: '/ai/video-parse', name: '视频去水印', icon: '🎬', color: 'red', desc: '抖音、TikTok等平台' },
  { path: '/ai/writer', name: 'AI文案生成', icon: '✍️', color: 'purple', desc: '营销文案/标题' },
  { path: '/ai/ocr', name: '文字识别', icon: '🔍', color: 'pink', desc: '图片转文字' },
  { path: '/ai/eraser', name: 'AI去水印', icon: '🧹', color: 'blue', desc: '智能消除' },
  { path: '/ai/tts', name: 'AI配音', icon: '🎙️', color: 'green', desc: '文字转语音' },
  { path: '/dsx2api', name: 'API中转', icon: '🔌', color: 'orange', desc: 'GPT/Claude低价调用' }
]

const goToTool = (path: string) => {
  router.push(path)
}

onMounted(() => {
  initGreeting()
  appStore.loadStats()
})

onActivated(() => {
  appStore.loadStats()
})
</script>

<template>
  <div class="page">
    <!-- 顶部欢迎区 -->
    <div class="header">
      <div class="header-top">
        <div class="greeting">
          <span class="greeting-text">{{ greeting }}</span>
          <span class="date-text">{{ date }}</span>
        </div>
        <div class="ai-tag">🤖 AI助手</div>
      </div>
      <p class="header-desc">AI赋能，让创作更简单</p>
    </div>

    <div class="content">
      <!-- AI工具网格 -->
      <div class="tools-grid">
        <div
          v-for="tool in tools"
          :key="tool.path"
          class="tool-card"
          @click="goToTool(tool.path)"
        >
          <div :class="['tool-icon', tool.color]">
            <span>{{ tool.icon }}</span>
          </div>
          <span class="tool-name">{{ tool.name }}</span>
          <span class="tool-desc">{{ tool.desc }}</span>
        </div>
      </div>

      <!-- 使用统计 -->
      <div class="stats-section">
        <span class="stats-title">使用统计</span>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-num">{{ appStore.aiStats.aiWrites }}</span>
            <span class="stat-label">文案生成</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">{{ appStore.aiStats.aiOcr }}</span>
            <span class="stat-label">文字识别</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">{{ appStore.aiStats.aiErase }}</span>
            <span class="stat-label">去水印</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">{{ appStore.aiStats.aiTts }}</span>
            <span class="stat-label">配音生成</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  padding: 20px 16px;
  color: white;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.greeting {
  display: flex;
  flex-direction: column;
}

.greeting-text {
  font-size: 24px;
  font-weight: bold;
}

.date-text {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
}

.ai-tag {
  background: rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.header-desc {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 8px;
}

.content {
  padding: 16px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.tool-card {
  background: white;
  border-radius: 16px;
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.tool-card:active {
  transform: scale(0.98);
}

.tool-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.tool-icon.red { background: #ffebee; }
.tool-icon.purple { background: #f3e5f5; }
.tool-icon.pink { background: #fce4ec; }
.tool-icon.blue { background: #dbeafe; }
.tool-icon.green { background: #dcfce7; }

.tool-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.tool-desc {
  font-size: 11px;
  color: #999;
}

.stats-section {
  margin-top: 24px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  padding: 16px;
}

.stats-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
  display: block;
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 20px;
  font-weight: bold;
  color: white;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}
</style>
