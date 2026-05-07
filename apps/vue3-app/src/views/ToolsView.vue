<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const searchText = ref('')
const showSearch = ref(false)

const categories = ref([
  {
    name: 'AI智能',
    icon: '🤖',
    toolList: [
      { key: 'aiToolbox', name: 'AI工具箱', icon: '🤖', desc: '文案生成、文字识别、去水印、配音', highlight: true }
    ]
  },
  {
    name: '常用工具',
    icon: '🔥',
    toolList: [
      { key: 'currency', name: '汇率换算', icon: '💱', desc: '实时汇率查询' },
      { key: 'qr', name: '二维码工具', icon: '🔲', desc: '生成与识别' },
      { key: 'express', name: '快递查询', icon: '📦', desc: '全网物流追踪' }
    ]
  },
  {
    name: '内容创作',
    icon: '🎨',
    toolList: [
      { key: 'converter', name: '单位换算', icon: '⚖️', desc: '长度/重量/温度' },
      { key: 'translator', name: '翻译助手', icon: '🌍', desc: '多国语言翻译' }
    ]
  },
  {
    name: '生活助手',
    icon: '🏠',
    toolList: [
      { key: 'decision', name: '决策助手', icon: '🎲', desc: '帮你做决定' }
    ]
  }
])

const tools = {
  aiToolbox: { name: 'AI工具箱', action: '/ai' },
  currency: { name: '汇率换算', action: '/tools/currency' },
  qr: { name: '二维码工具', action: '/tools/qrcode' },
  express: { name: '快递查询', action: '/tools/express' },
  converter: { name: '单位换算', action: '/tools/converter' },
  translator: { name: '翻译助手', action: '/tools/translator' },
  decision: { name: '决策助手', action: '/tools/decision' }
}

const searchResults = computed(() => {
  if (!searchText.value) return []
  const text = searchText.value.toLowerCase()
  const results: any[] = []
  for (const [key, tool] of Object.entries(tools)) {
    if (tool.name.toLowerCase().includes(text) || tool.desc?.toLowerCase().includes(text)) {
      results.push({ key, ...tool })
    }
  }
  return results
})

const onSearchInput = () => {
  showSearch.value = searchText.value.length > 0
}

const clearSearch = () => {
  searchText.value = ''
  showSearch.value = false
}

const onToolTap = (key: string) => {
  const tool = tools[key as keyof typeof tools]
  if (tool) {
    router.push(tool.action)
  }
}

const goToAI = () => router.push('/ai')
</script>

<template>
  <div class="page">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <div class="search-input-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchText"
          class="search-input"
          placeholder="搜索工具，如：汇率、二维码..."
          @input="onSearchInput"
        />
        <span v-if="searchText" class="clear-btn" @click="clearSearch">✕</span>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="showSearch" class="search-results">
      <span class="results-title">"{{ searchText }}" 的搜索结果</span>
      <div v-if="searchResults.length === 0" class="no-results">
        <span>没有找到相关工具</span>
      </div>
      <div v-else class="tools-grid">
        <div
          v-for="item in searchResults"
          :key="item.key"
          class="tool-card"
          @click="onToolTap(item.key)"
        >
          <span class="tool-icon">{{ item.icon }}</span>
          <span class="tool-name">{{ item.name }}</span>
          <span class="tool-desc">{{ item.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 正常内容 -->
    <div v-else class="main-content">
      <!-- 快捷操作区 -->
      <div class="quick-section">
        <div class="section-title">智能识别</div>
        <div class="quick-actions">
          <div class="quick-item" @click="goToAI">
            <span class="quick-icon">🤖</span>
            <span class="quick-name">AI工具箱</span>
          </div>
          <div class="quick-item" @click="onToolTap('currency')">
            <span class="quick-icon">💱</span>
            <span class="quick-name">汇率换算</span>
          </div>
          <div class="quick-item" @click="onToolTap('qr')">
            <span class="quick-icon">🔲</span>
            <span class="quick-name">二维码</span>
          </div>
          <div class="quick-item" @click="onToolTap('express')">
            <span class="quick-icon">📦</span>
            <span class="quick-name">查快递</span>
          </div>
        </div>
      </div>

      <!-- 工具分类 -->
      <div class="categories">
        <div v-for="cat in categories" :key="cat.name" class="category">
          <div class="category-header">
            <span class="category-icon">{{ cat.icon }}</span>
            <span class="category-name">{{ cat.name }}</span>
          </div>
          <div class="tools-grid">
            <div
              v-for="tool in cat.toolList"
              :key="tool.key"
              :class="['tool-card', tool.highlight ? 'highlight' : '']"
              @click="onToolTap(tool.key)"
            >
              <span class="tool-icon">{{ tool.icon }}</span>
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-desc">{{ tool.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.search-bar {
  background: white;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 8px 16px;
  gap: 8px;
}

.search-icon {
  font-size: 16px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
}

.clear-btn {
  color: #999;
  cursor: pointer;
  font-size: 14px;
}

.search-results {
  padding: 16px;
}

.results-title {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 12px;
}

.no-results {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.main-content {
  padding: 16px;
}

.quick-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  background: white;
  border-radius: 12px;
  cursor: pointer;
}

.quick-icon {
  font-size: 24px;
}

.quick-name {
  font-size: 11px;
  color: #666;
}

.category {
  margin-bottom: 20px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.category-icon {
  font-size: 18px;
}

.category-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.tool-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.tool-card:active {
  transform: scale(0.98);
}

.tool-card.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.tool-card.highlight .tool-name,
.tool-card.highlight .tool-desc {
  color: white;
}

.tool-icon {
  font-size: 28px;
}

.tool-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.tool-desc {
  font-size: 11px;
  color: #999;
  text-align: center;
}
</style>
