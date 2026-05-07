<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const topic = ref('')
const selectedPlatform = ref('douyin')
const selectedStyle = ref('casual')
const result = ref('')
const tags = ref<string[]>([])
const isGenerating = ref(false)
const history = ref<any[]>([])

const platforms = [
  { id: 'douyin', name: '抖音', icon: '🎵' },
  { id: 'xiaohongshu', name: '小红书', icon: '📕' },
  { id: 'moments', name: '朋友圈', icon: '📱' },
  { id: 'weibo', name: '微博', icon: '🌐' }
]

const styles = [
  { id: 'funny', name: '幽默风趣', emoji: '😄' },
  { id: 'emotional', name: '情感共鸣', emoji: '❤️' },
  { id: 'professional', name: '专业严谨', emoji: '📚' },
  { id: 'casual', name: '轻松随意', emoji: '☀️' }
]

const selectPlatform = (id: string) => {
  selectedPlatform.value = id
}

const selectStyle = (id: string) => {
  selectedStyle.value = id
}

const generateContent = () => {
  if (!topic.value.trim()) {
    alert('请输入视频主题')
    return
  }

  isGenerating.value = true
  appStore.updateStats('aiWrites')

  // Simulate AI generation
  setTimeout(() => {
    const platformNames: Record<string, string> = {
      douyin: '抖音',
      xiaohongshu: '小红书',
      moments: '朋友圈',
      weibo: '微博'
    }

    result.value = `这是一段为"${topic.value}"生成的${platformNames[selectedPlatform.value]}风格文案。

开头要有悬念，抓住用户注意力。
中间有情节反转或惊喜。
结尾要有互动引导（点赞、评论）。

#${topic.value} #热门 #推荐`
    tags.value = [`#${topic.value}`, '#热门', '#推荐', '#必看']
    isGenerating.value = false

    // Save to history
    history.value.unshift({
      topic: topic.value,
      platform: platformNames[selectedPlatform.value],
      content: result.value,
      tags: tags.value
    })
  }, 2000)
}

const copyResult = () => {
  if (!result.value) return
  const content = tags.value.length > 0 ? result.value + '\n\n' + tags.value.join(' ') : result.value
  navigator.clipboard.writeText(content).then(() => {
    alert('已复制到剪贴板')
  })
}

const regenerate = () => {
  generateContent()
}

const onTopicInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  topic.value = target.value
}
</script>

<template>
  <div class="page">
    <div class="content">
      <!-- 输入 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">输入主题</span>
          <span class="char-count">{{ topic.length }}/200</span>
        </div>
        <textarea
          class="textarea"
          placeholder="描述视频内容，例如：分享一款超好用的护肤品..."
          :value="topic"
          @input="onTopicInput"
          maxlength="200"
        ></textarea>
      </div>

      <!-- 平台选择 -->
      <div class="card">
        <span class="card-title">选择平台</span>
        <div class="platform-grid">
          <div
            v-for="p in platforms"
            :key="p.id"
            :class="['platform-item', { active: selectedPlatform === p.id }]"
            @click="selectPlatform(p.id)"
          >
            <span class="platform-icon">{{ p.icon }}</span>
            <span class="platform-name">{{ p.name }}</span>
          </div>
        </div>
      </div>

      <!-- 风格选择 -->
      <div class="card">
        <span class="card-title">文案风格</span>
        <div class="style-list">
          <div
            v-for="s in styles"
            :key="s.id"
            :class="['style-item', { active: selectedStyle === s.id }]"
            @click="selectStyle(s.id)"
          >
            {{ s.emoji }} {{ s.name }}
          </div>
        </div>
      </div>

      <!-- 生成按钮 -->
      <button
        class="generate-btn"
        :class="{ loading: isGenerating }"
        :disabled="!topic || isGenerating"
        @click="generateContent"
      >
        {{ isGenerating ? '✨ 生成中...' : '🤖 AI生成文案' }}
      </button>

      <!-- 结果 -->
      <div v-if="result" class="card result-card">
        <div class="result-header">
          <span class="card-title">生成结果</span>
          <div class="result-actions">
            <span class="action-btn" @click="copyResult">复制</span>
            <span class="action-btn" @click="regenerate">重新生成</span>
          </div>
        </div>
        <div class="result-content">{{ result }}</div>
        <div v-if="tags.length > 0" class="tags">
          <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>

      <!-- 历史 -->
      <div v-if="history.length > 0" class="card">
        <div class="history-header">
          <span class="card-title">历史记录</span>
          <span class="clear-btn" @click="history = []">清空</span>
        </div>
        <div
          v-for="(item, index) in history"
          :key="index"
          class="history-item"
          @click="topic = item.topic; result = item.content; tags = item.tags"
        >
          <span class="history-topic">{{ item.topic }}</span>
          <span class="history-platform">{{ item.platform }}</span>
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.char-count {
  font-size: 12px;
  color: #999;
}

.textarea {
  width: 100%;
  min-height: 100px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.textarea:focus {
  border-color: #667eea;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.platform-item {
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

.platform-item.active {
  border-color: #667eea;
  background: #f8f5ff;
}

.platform-icon {
  font-size: 24px;
}

.platform-name {
  font-size: 12px;
  color: #666;
}

.style-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.style-item {
  padding: 8px 16px;
  border-radius: 20px;
  background: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.style-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.generate-btn {
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

.generate-btn:disabled {
  opacity: 0.6;
}

.result-card {
  border: 2px solid #667eea;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-actions {
  display: flex;
  gap: 12px;
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

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.tag {
  background: #f3e8ff;
  color: #667eea;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
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
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.history-item:last-child {
  border-bottom: none;
}

.history-topic {
  font-size: 14px;
  color: #333;
  display: block;
}

.history-platform {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}
</style>
