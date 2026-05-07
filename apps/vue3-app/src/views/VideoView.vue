<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface ResultData {
  title: string
  photo: string
  videourl?: string
  downurl?: string
  pics?: string[]
}

const resultData = ref<ResultData | null>(null)
const isFavorite = ref(false)
const favorites = ref<ResultData[]>([])

const isVideo = computed(() => !!resultData.value?.downurl)
const isImage = computed(() => resultData.value?.pics && resultData.value.pics.length > 0)

onMounted(() => {
  const data = route.query.data
  if (data) {
    try {
      resultData.value = JSON.parse(decodeURIComponent(data as string))
      if (resultData.value) {
        saveToHistory(resultData.value)
      }
    } catch (e) {
      console.error('解析数据失败', e)
    }
  }
  loadFavorites()
  checkFavorite()
})

const loadFavorites = () => {
  const stored = localStorage.getItem('favorites')
  if (stored) {
    favorites.value = JSON.parse(stored)
  }
}

const saveToHistory = (data: ResultData) => {
  let history = JSON.parse(localStorage.getItem('parseHistory') || '[]')
  const historyItem = {
    id: Date.now().toString(),
    title: data.title || '未命名',
    cover: data.photo || '',
    type: data.downurl ? 'video' : 'image',
    url: data.videourl || data.pics?.[0] || '',
    downurl: data.downurl || '',
    pics: data.pics || [],
    createdAt: new Date().toISOString(),
    favorited: false
  }
  const existingIndex = history.findIndex((item: any) => item.url === historyItem.url)
  if (existingIndex !== -1) {
    history[existingIndex].createdAt = historyItem.createdAt
    history[existingIndex].title = historyItem.title
    history[existingIndex].cover = historyItem.cover
  } else {
    history.unshift(historyItem)
  }
  if (history.length > 30) {
    history = history.slice(0, 30)
  }
  localStorage.setItem('parseHistory', JSON.stringify(history))
}

const checkFavorite = () => {
  if (!resultData.value) return
  const url = resultData.value.videourl || resultData.value.pics?.[0]
  isFavorite.value = favorites.value.some(item => item.videourl === url || item.pics?.[0] === url)
}

const toggleFavorite = () => {
  if (!resultData.value) return
  const url = resultData.value.videourl || resultData.value.pics?.[0]
  const existingIndex = favorites.value.findIndex(item =>
    item.videourl === url || item.pics?.[0] === url
  )

  if (existingIndex !== -1) {
    favorites.value.splice(existingIndex, 1)
    isFavorite.value = false
    alert('已取消收藏')
  } else {
    favorites.value.unshift(resultData.value)
    isFavorite.value = true
    alert('已收藏')
  }
  localStorage.setItem('favorites', JSON.stringify(favorites.value))
}

const copyTitle = () => {
  if (!resultData.value?.title) return
  navigator.clipboard.writeText(resultData.value.title).then(() => {
    alert('标题已复制')
  })
}

const copyLink = () => {
  if (!resultData.value?.downurl) return
  navigator.clipboard.writeText(resultData.value.downurl).then(() => {
    alert('链接已复制')
  })
}

const downloadVideo = () => {
  if (!resultData.value?.downurl) return
  window.open(resultData.value.downurl, '_blank')
}

const downloadAllPics = () => {
  if (!resultData.value?.pics?.length) return
  resultData.value.pics.forEach((pic, index) => {
    const a = document.createElement('a')
    a.href = pic
    a.download = `image_${index + 1}.jpg`
    a.target = '_blank'
    a.click()
  })
}

const goToHistory = () => {
  router.push('/kj?type=history')
}
</script>

<template>
  <div class="page">
    <!-- 顶部导航栏 -->
    <div class="header-bar">
      <div class="header-actions">
        <div :class="['action-chip', { active: isFavorite }]" @click="toggleFavorite">
          <span class="action-chip-icon">{{ isFavorite ? '❤️' : '🤍' }}</span>
          <span class="action-chip-text">{{ isFavorite ? '已收藏' : '收藏' }}</span>
        </div>
        <div class="action-chip" @click="goToHistory">
          <span class="action-chip-icon">📜</span>
          <span class="action-chip-text">历史</span>
        </div>
      </div>
    </div>

    <div class="content">
      <!-- 内容卡片 -->
      <div class="content-card">
        <!-- 封面图 -->
        <div class="cover-container">
          <img v-if="resultData?.photo" :src="resultData.photo" class="cover-image" alt="封面" />
          <div class="cover-badge">
            <span class="cover-badge-text">
              {{ isVideo ? '🎬 视频' : '🖼️ 图集' }}
            </span>
          </div>
        </div>

        <!-- 标题 -->
        <div class="title-section">
          <span class="title-text">{{ resultData?.title || '无标题' }}</span>
        </div>

        <!-- 视频下载区域 -->
        <div v-if="isVideo" class="section">
          <div class="section-title">视频操作</div>
          <div class="video-actions">
            <div class="action-btn-large copy-btn" @click="copyTitle">
              <span class="action-btn-icon">📋</span>
              <span class="action-btn-text">复制标题</span>
            </div>
            <div class="action-btn-large link-btn" @click="copyLink">
              <span class="action-btn-icon">🔗</span>
              <span class="action-btn-text">复制链接</span>
            </div>
          </div>
          <div class="action-btn-full" @click="downloadVideo">
            <span class="action-btn-icon-full">⬇️</span>
            <span class="action-btn-text-full">下载视频</span>
          </div>
        </div>

        <!-- 图片下载区域 -->
        <div v-if="isImage" class="section">
          <div class="section-title">图片操作</div>
          <div class="pics-grid">
            <img
              v-for="(pic, index) in resultData?.pics"
              :key="index"
              :src="pic"
              class="pic-item"
              :alt="'图片' + (index + 1)"
            />
          </div>
          <div class="action-btn-full" @click="downloadAllPics">
            <span class="action-btn-icon-full">⬇️</span>
            <span class="action-btn-text-full">下载全部图片</span>
          </div>
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="tips-card">
        <span class="tips-title">💡 提示</span>
        <span class="tips-item">• 点击下载按钮可保存视频/图片</span>
        <span class="tips-item">• 复制链接后可粘贴到其他应用使用</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.header-bar {
  background: white;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  background: #f5f5f5;
  cursor: pointer;
}

.action-chip.active {
  background: #ffebee;
}

.action-chip-icon {
  font-size: 14px;
}

.action-chip-text {
  font-size: 12px;
  color: #666;
}

.content {
  padding: 16px;
}

.content-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.cover-container {
  position: relative;
}

.cover-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.cover-badge {
  position: absolute;
  top: 12px;
  left: 12px;
}

.cover-badge-text {
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.title-section {
  padding: 16px;
}

.title-text {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  line-height: 1.6;
}

.section {
  padding: 0 16px 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.video-actions {
  display: flex;
  gap: 12px;
}

.action-btn-large {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
}

.action-btn-icon {
  font-size: 16px;
}

.action-btn-text {
  font-size: 14px;
}

.copy-btn {
  background: #e3f2fd;
  color: #1976d2;
}

.link-btn {
  background: #f3e5f5;
  color: #7b1fa2;
}

.action-btn-full {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  margin-top: 12px;
  cursor: pointer;
}

.action-btn-icon-full {
  font-size: 18px;
}

.action-btn-text-full {
  font-size: 14px;
  color: white;
}

.pics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.pic-item {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.tips-card {
  background: #e3f2fd;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #1976d2;
  display: block;
  margin-bottom: 8px;
}

.tips-item {
  font-size: 12px;
  color: #666;
  display: block;
  margin-top: 4px;
}
</style>
