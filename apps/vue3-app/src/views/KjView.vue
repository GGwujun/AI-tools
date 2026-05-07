<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('history')
const historyList = ref<any[]>([])
const favoriteList = ref<any[]>([])

const loadData = () => {
  // Load from localStorage
  const history = localStorage.getItem('parseHistory')
  if (history) {
    historyList.value = JSON.parse(history)
  }
  const favorites = localStorage.getItem('favorites')
  if (favorites) {
    favoriteList.value = JSON.parse(favorites)
  }
}

const switchTab = (tab: string) => {
  activeTab.value = tab
}

const goToParse = () => {
  router.push('/ai/video-parse')
}

const viewDetail = (item: any) => {
  router.push({
    path: '/video',
    query: { data: encodeURIComponent(JSON.stringify(item)) }
  })
}

const deleteHistory = (id: string) => {
  historyList.value = historyList.value.filter(item => item.id !== id)
  localStorage.setItem('parseHistory', JSON.stringify(historyList.value))
}

const clearHistory = () => {
  if (confirm('确定要清空所有历史记录吗？')) {
    historyList.value = []
    localStorage.setItem('parseHistory', '[]')
  }
}

const clearFavorites = () => {
  if (confirm('确定要清空所有收藏吗？')) {
    favoriteList.value = []
    localStorage.setItem('favorites', '[]')
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="page">
    <!-- 顶部标签 -->
    <div class="tab-bar">
      <div
        :class="['tab-item', { active: activeTab === 'history' }]"
        @click="switchTab('history')"
      >
        <span class="tab-text">历史记录</span>
        <span v-if="historyList.length > 0" class="tab-badge">{{ historyList.length }}</span>
      </div>
      <div
        :class="['tab-item', { active: activeTab === 'favorite' }]"
        @click="switchTab('favorite')"
      >
        <span class="tab-text">我的收藏</span>
        <span v-if="favoriteList.length > 0" class="tab-badge">{{ favoriteList.length }}</span>
      </div>
    </div>

    <!-- 历史记录列表 -->
    <div v-if="activeTab === 'history'" class="list-container">
      <div v-if="historyList.length === 0" class="empty-state">
        <span class="empty-icon">🕐</span>
        <span class="empty-text">暂无历史记录</span>
        <span class="empty-desc">去解析视频，记录会自动保存到这里</span>
        <button class="action-btn" @click="goToParse">去解析</button>
      </div>

      <div v-else class="item-list">
        <div class="clear-bar" @click="clearHistory">
          <span class="clear-text">清空历史</span>
        </div>

        <div
          v-for="item in historyList"
          :key="item.id"
          class="history-item"
          @click="viewDetail(item)"
        >
          <div class="item-cover">
            <img :src="item.cover" class="cover-img" alt="封面" />
            <div :class="['type-tag', item.type]">{{ item.type === 'video' ? '视频' : '图集' }}</div>
          </div>
          <div class="item-info">
            <span class="item-title">{{ item.title }}</span>
            <span class="item-time">{{ new Date(item.createdAt).toLocaleDateString() }}</span>
          </div>
          <div class="item-actions">
            <button class="mini-btn delete" @click.stop="deleteHistory(item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 收藏列表 -->
    <div v-if="activeTab === 'favorite'" class="list-container">
      <div v-if="favoriteList.length === 0" class="empty-state">
        <span class="empty-icon">☆</span>
        <span class="empty-text">暂无收藏</span>
        <span class="empty-desc">在视频详情页点击收藏，内容会保存在这里</span>
        <button class="action-btn" @click="goToParse">去解析</button>
      </div>

      <div v-else class="item-list">
        <div class="clear-bar" @click="clearFavorites">
          <span class="clear-text">清空收藏</span>
        </div>

        <div
          v-for="item in favoriteList"
          :key="item.id"
          class="history-item"
          @click="viewDetail(item)"
        >
          <div class="item-cover">
            <img :src="item.cover" class="cover-img" alt="封面" />
            <div :class="['type-tag', item.type]">{{ item.type === 'video' ? '视频' : '图集' }}</div>
          </div>
          <div class="item-info">
            <span class="item-title">{{ item.title }}</span>
            <span class="item-time">{{ new Date(item.createdAt).toLocaleDateString() }}</span>
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

.tab-bar {
  display: flex;
  background: white;
  border-bottom: 1px solid #eee;
}

.tab-item {
  flex: 1;
  padding: 14px 0;
  text-align: center;
  cursor: pointer;
  color: #666;
  font-size: 14px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-item.active {
  color: #667eea;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  background: #667eea;
  border-radius: 2px;
}

.tab-badge {
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.list-container {
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 12px;
  color: #999;
  text-align: center;
  margin-bottom: 16px;
}

.action-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

.clear-bar {
  padding: 12px 0;
  text-align: right;
}

.clear-text {
  font-size: 12px;
  color: #ff5252;
}

.history-item {
  display: flex;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
}

.item-cover {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.type-tag {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.item-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.item-actions {
  display: flex;
  align-items: center;
}

.mini-btn {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  border: none;
}

.mini-btn.delete {
  background: #ffebee;
  color: #ff5252;
}
</style>
