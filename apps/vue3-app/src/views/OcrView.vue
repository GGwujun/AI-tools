<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const selectedImage = ref('')
const selectedMode = ref('general')
const result = ref('')
const costTime = ref(0)
const isRecognizing = ref(false)
const history = ref<any[]>([])

const modes = [
  { id: 'general', name: '通用文字', icon: '📝' },
  { id: 'idcard', name: '身份证', icon: '🪪' },
  { id: 'bankcard', name: '银行卡', icon: '💳' },
  { id: 'business', name: '营业执照', icon: '📄' }
]

const selectMode = (id: string) => {
  selectedMode.value = id
}

const chooseImage = () => {
  // Create file input
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        selectedImage.value = e.target?.result as string
        result.value = ''
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const startRecognize = () => {
  if (!selectedImage.value) {
    alert('请先选择图片')
    return
  }

  isRecognizing.value = true
  appStore.updateStats('aiOcr')
  const startTime = Date.now()

  // Simulate AI OCR
  setTimeout(() => {
    costTime.value = ((Date.now() - startTime) / 1000).toFixed(1) as any
    result.value = `【模拟识别结果】

由于当前运行在浏览器环境中，无法调用真实的OCR API。

在生产环境中，这里会显示从图片中提取的文字内容。

识别模式：${modes.find(m => m.id === selectedMode.value)?.name}
识别耗时：${costTime.value}秒

如需使用真实OCR功能，请部署到服务器环境。`

    // Save to history
    history.value.unshift({
      thumb: selectedImage.value,
      result: result.value,
      time: new Date().toLocaleString()
    })

    isRecognizing.value = false
  }, 2000)
}

const copyResult = () => {
  if (!result.value) return
  navigator.clipboard.writeText(result.value).then(() => {
    alert('已复制')
  })
}
</script>

<template>
  <div class="page">
    <div class="content">
      <!-- 上传区域 -->
      <div class="card">
        <div v-if="!selectedImage" class="upload-area" @click="chooseImage">
          <span class="upload-icon">📷</span>
          <span class="upload-text">点击上传图片</span>
          <span class="upload-tip">支持 JPG、PNG，最大 5MB</span>
        </div>
        <div v-else class="preview-area">
          <img :src="selectedImage" class="preview-image" alt="预览" />
          <span class="change-btn" @click="chooseImage">更换图片</span>
        </div>
      </div>

      <!-- 识别模式 -->
      <div class="card">
        <span class="card-title">识别模式</span>
        <div class="mode-grid">
          <div
            v-for="m in modes"
            :key="m.id"
            :class="['mode-item', { active: selectedMode === m.id }]"
            @click="selectMode(m.id)"
          >
            <span class="mode-icon">{{ m.icon }}</span>
            <span class="mode-name">{{ m.name }}</span>
          </div>
        </div>
      </div>

      <!-- 识别按钮 -->
      <button
        class="recognize-btn"
        :class="{ loading: isRecognizing }"
        :disabled="!selectedImage || isRecognizing"
        @click="startRecognize"
      >
        {{ isRecognizing ? '识别中...' : '🔍 开始识别' }}
      </button>

      <!-- 结果 -->
      <div v-if="result" class="card">
        <div class="result-header">
          <span class="card-title">识别结果</span>
          <span class="action-btn" @click="copyResult">复制</span>
        </div>
        <div class="result-content">{{ result }}</div>
        <div class="result-info">
          <span>识别耗时：{{ costTime }}秒</span>
          <span>文字数量：{{ result.length }}字</span>
        </div>
      </div>

      <!-- 历史 -->
      <div v-if="history.length > 0" class="card">
        <div class="history-header">
          <span class="card-title">识别历史</span>
          <span class="clear-btn" @click="history = []">清空</span>
        </div>
        <div
          v-for="(item, index) in history"
          :key="index"
          class="history-item"
        >
          <img :src="item.thumb" class="history-thumb" alt="缩略图" />
          <div class="history-info">
            <span class="history-text">{{ item.result.substring(0, 50) }}...</span>
            <span class="history-time">{{ item.time }}</span>
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

.content {
  padding: 16px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12px;
}

.upload-area {
  border: 2px dashed #ddd;
  border-radius: 12px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.upload-icon {
  font-size: 48px;
}

.upload-text {
  font-size: 16px;
  color: #333;
}

.upload-tip {
  font-size: 12px;
  color: #999;
}

.preview-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
}

.change-btn {
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.mode-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-item.active {
  border-color: #667eea;
  background: #f8f5ff;
}

.mode-icon {
  font-size: 24px;
}

.mode-name {
  font-size: 11px;
  color: #666;
}

.recognize-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 12px;
}

.recognize-btn:disabled {
  opacity: 0.6;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.action-btn {
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
}

.result-content {
  font-size: 14px;
  color: #333;
  line-height: 1.8;
  white-space: pre-wrap;
}

.result-info {
  display: flex;
  gap: 20px;
  margin-top: 12px;
  font-size: 12px;
  color: #999;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.clear-btn {
  color: #999;
  font-size: 14px;
  cursor: pointer;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.history-item:last-child {
  border-bottom: none;
}

.history-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 8px;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.history-text {
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
</style>
