<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const selectedImage = ref('')
const resultImage = ref('')
const brushSize = ref(20)
const brushPoints = ref<{ x: number; y: number }[]>([])
const isProcessing = ref(false)
const isDrawing = ref(false)

const chooseImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        selectedImage.value = e.target?.result as string
        resultImage.value = ''
        brushPoints.value = []
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const onBrushSizeChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  brushSize.value = parseInt(target.value)
}

const onCanvasStart = (e: MouseEvent) => {
  isDrawing.value = true
  const canvas = e.target as HTMLCanvasElement
  const rect = canvas.getBoundingClientRect()
  brushPoints.value.push({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  })
}

const onCanvasMove = (e: MouseEvent) => {
  if (!isDrawing.value) return
  const canvas = e.target as HTMLCanvasElement
  const rect = canvas.getBoundingClientRect()
  brushPoints.value.push({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  })
  drawBrushStroke()
}

const onCanvasEnd = () => {
  isDrawing.value = false
}

const drawBrushStroke = () => {
  const canvas = document.querySelector('.draw-canvas') as HTMLCanvasElement
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = 'rgba(102, 126, 234, 0.6)'
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (brushPoints.value.length > 0) {
    ctx.beginPath()
    ctx.moveTo(brushPoints.value[0].x, brushPoints.value[0].y)
    for (let i = 1; i < brushPoints.value.length; i++) {
      ctx.lineTo(brushPoints.value[i].x, brushPoints.value[i].y)
    }
    ctx.stroke()
  }
}

const resetCanvas = () => {
  brushPoints.value = []
  const canvas = document.querySelector('.draw-canvas') as HTMLCanvasElement
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

const startProcess = () => {
  if (!selectedImage.value) {
    alert('请先选择图片')
    return
  }

  if (brushPoints.value.length < 5) {
    alert('请先涂抹要去除的区域')
    return
  }

  isProcessing.value = true
  appStore.updateStats('aiErase')

  setTimeout(() => {
    // In real implementation, this would call an AI API to remove watermark
    resultImage.value = selectedImage.value
    isProcessing.value = false
    alert('处理完成（浏览器环境下为模拟效果）')
  }, 2500)
}
</script>

<template>
  <div class="page">
    <div class="content">
      <!-- 提示 -->
      <div class="tips-card">
        <span class="tips-icon">💡</span>
        <div class="tips-text">
          <span class="tips-title">使用说明</span>
          <span class="tips-desc">上传图片后，用手指涂抹要去除的水印区域，AI将自动处理</span>
        </div>
      </div>

      <!-- 上传 -->
      <div class="card">
        <div v-if="!selectedImage" class="upload-area" @click="chooseImage">
          <span class="upload-icon">🖼️</span>
          <span class="upload-text">点击上传图片</span>
          <span class="upload-tip">支持 JPG、PNG，最大 10MB</span>
        </div>
        <div v-else class="edit-area">
          <div class="image-wrapper">
            <img :src="selectedImage" class="edit-image" alt="编辑图片" />
            <canvas
              class="draw-canvas"
              width="300"
              height="300"
              @mousedown="onCanvasStart"
              @mousemove="onCanvasMove"
              @mouseup="onCanvasEnd"
              @mouseleave="onCanvasEnd"
            ></canvas>
          </div>
          <div class="edit-actions">
            <span class="action-btn" @click="resetCanvas">重置</span>
            <span class="action-btn" @click="chooseImage">更换图片</span>
          </div>
          <div class="brush-section">
            <span class="brush-label">画笔大小：{{ brushSize }}</span>
            <input
              type="range"
              class="brush-slider"
              min="10"
              max="50"
              :value="brushSize"
              @input="onBrushSizeChange"
            />
          </div>
        </div>
      </div>

      <!-- 处理按钮 -->
      <button
        class="process-btn"
        :class="{ loading: isProcessing }"
        :disabled="!selectedImage || brushPoints.length < 5 || isProcessing"
        @click="startProcess"
      >
        {{ isProcessing ? '处理中...' : '✨ AI智能去水印' }}
      </button>

      <!-- 结果 -->
      <div v-if="resultImage" class="card">
        <span class="card-title">处理完成</span>
        <div class="result-compare">
          <div class="compare-item">
            <img :src="selectedImage" class="compare-image" alt="原图" />
            <span class="compare-label">原图</span>
          </div>
          <div class="compare-item">
            <img :src="resultImage" class="compare-image" alt="效果图" />
            <span class="compare-label">效果图</span>
          </div>
        </div>
      </div>

      <!-- 提示 -->
      <div v-if="selectedImage && !resultImage" class="tips-box">
        <span class="tips-text">提示：用手指在图片上涂抹选择要去除的水印区域，然后点击"AI智能去水印"按钮</span>
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

.tips-card {
  background: #fff3e0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.tips-icon {
  font-size: 24px;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #ff9800;
  display: block;
}

.tips-desc {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  display: block;
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

.edit-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.image-wrapper {
  position: relative;
  display: inline-block;
}

.edit-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
}

.draw-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.edit-actions {
  display: flex;
  gap: 20px;
}

.action-btn {
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
}

.brush-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brush-label {
  font-size: 14px;
  color: #666;
}

.brush-slider {
  width: 100%;
}

.process-btn {
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

.process-btn:disabled {
  opacity: 0.6;
}

.result-compare {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.compare-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.compare-image {
  width: 100%;
  border-radius: 8px;
}

.compare-label {
  font-size: 12px;
  color: #666;
}

.tips-box {
  background: #e3f2fd;
  border-radius: 12px;
  padding: 16px;
}

.tips-box .tips-text {
  font-size: 12px;
  color: #1976d2;
}
</style>
