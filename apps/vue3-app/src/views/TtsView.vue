<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const text = ref('')
const selectedVoice = ref('female_youth')
const speed = ref(1)
const pitch = ref(1)
const volume = ref(1)
const isGenerating = ref(false)
const isPlaying = ref(false)

const voices = [
  { id: 'female_youth', name: '女声-青年', icon: '👩', desc: '清新自然，适合日常内容' },
  { id: 'female_mature', name: '女声-成熟', icon: '👩‍💼', desc: '知性稳重，适合商务场景' },
  { id: 'male_youth', name: '男声-青年', icon: '👨', desc: '活力阳光，适合娱乐内容' },
  { id: 'male_mature', name: '男声-成熟', icon: '👨‍✈️', desc: '磁性低沉，适合解说配音' },
  { id: 'child', name: '童声', icon: '👧', desc: '天真可爱，适合儿童内容' },
  { id: 'robot', name: '机器人', icon: '🤖', desc: '科技感强，适合AI场景' }
]

const scenes = [
  { id: 'ad', name: '广告配音', icon: '📢' },
  { id: 'narrate', name: '视频旁白', icon: '🎬' },
  { id: 'notice', name: '通知播报', icon: '📋' },
  { id: 'service', name: '智能客服', icon: '🤖' }
]

const selectVoice = (id: string) => {
  selectedVoice.value = id
}

const onTextInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  text.value = target.value
}

const onSpeedChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  speed.value = parseFloat(target.value)
}

const onPitchChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  pitch.value = parseFloat(target.value)
}

const onVolumeChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  volume.value = parseFloat(target.value)
}

const generateAudio = () => {
  if (!text.value.trim()) {
    alert('请输入文本')
    return
  }

  isGenerating.value = true
  appStore.updateStats('aiTts')

  setTimeout(() => {
    isGenerating.value = false
    alert('语音生成成功（浏览器环境下为模拟效果）')
  }, 2500)
}

const playVoice = () => {
  if (isPlaying.value) {
    isPlaying.value = false
  } else {
    alert('浏览器环境无法播放音频')
  }
}

const applyScene = (sceneId: string) => {
  const sceneTexts: Record<string, string> = {
    ad: '欢迎来到直播间！今天给大家带来一款超值的商品，原价99元，现在只要49元！库存有限，先到先得！',
    narrate: '在繁华的都市中，每个人都在为自己的梦想努力着。这条路很长，但只要坚持，终会到达彼岸。',
    notice: '您好，您有一笔新的订单等待处理，请及时查看。感谢您的使用，祝您生活愉快！',
    service: '您好，欢迎使用在线客服，请问有什么可以帮助您的？我们的客服团队随时为您服务。'
  }
  text.value = sceneTexts[sceneId] || ''
}
</script>

<template>
  <div class="page">
    <div class="content">
      <!-- 输入 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">输入文本</span>
          <span class="char-count">{{ text.length }}/500</span>
        </div>
        <textarea
          class="textarea"
          placeholder="请输入要转换为语音的文本..."
          :value="text"
          @input="onTextInput"
          maxlength="500"
        ></textarea>
      </div>

      <!-- 音色选择 -->
      <div class="card">
        <span class="card-title">选择音色</span>
        <div class="voice-grid">
          <div
            v-for="v in voices"
            :key="v.id"
            :class="['voice-item', { active: selectedVoice === v.id }]"
            @click="selectVoice(v.id)"
          >
            <span class="voice-icon">{{ v.icon }}</span>
            <span class="voice-name">{{ v.name }}</span>
            <span class="voice-desc">{{ v.desc }}</span>
          </div>
        </div>
      </div>

      <!-- 参数设置 -->
      <div class="card">
        <span class="card-title">参数设置</span>
        <div class="setting-item">
          <span class="setting-label">语速</span>
          <input
            type="range"
            class="setting-slider"
            min="0.5"
            max="2"
            step="0.1"
            :value="speed"
            @input="onSpeedChange"
          />
          <span class="setting-value">{{ speed.toFixed(1) }}</span>
        </div>
        <div class="setting-item">
          <span class="setting-label">音调</span>
          <input
            type="range"
            class="setting-slider"
            min="0.5"
            max="2"
            step="0.1"
            :value="pitch"
            @input="onPitchChange"
          />
          <span class="setting-value">{{ pitch.toFixed(1) }}</span>
        </div>
        <div class="setting-item">
          <span class="setting-label">音量</span>
          <input
            type="range"
            class="setting-slider"
            min="0"
            max="1"
            step="0.1"
            :value="volume"
            @input="onVolumeChange"
          />
          <span class="setting-value">{{ volume.toFixed(1) }}</span>
        </div>
      </div>

      <!-- 生成按钮 -->
      <button
        class="generate-btn"
        :class="{ loading: isGenerating }"
        :disabled="!text || isGenerating"
        @click="generateAudio"
      >
        {{ isGenerating ? '生成中...' : '🎙️ 生成语音' }}
      </button>

      <!-- 预览 -->
      <div v-if="false" class="card">
        <div class="preview-header">
          <span class="card-title">语音预览</span>
          <span class="duration">0秒</span>
        </div>
        <div class="audio-player">
          <div class="play-btn" @click="playVoice">
            <span>{{ isPlaying ? '⏸️' : '▶️' }}</span>
          </div>
          <span class="play-hint">点击播放（演示模式）</span>
        </div>
      </div>

      <!-- 场景模板 -->
      <div class="card">
        <span class="card-title">使用场景</span>
        <div class="scene-grid">
          <div
            v-for="s in scenes"
            :key="s.id"
            class="scene-item"
            @click="applyScene(s.id)"
          >
            <span class="scene-icon">{{ s.icon }}</span>
            <span class="scene-name">{{ s.name }}</span>
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

.voice-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.voice-item {
  padding: 12px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-item.active {
  border-color: #667eea;
  background: #f8f5ff;
}

.voice-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 6px;
}

.voice-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: block;
}

.voice-desc {
  font-size: 11px;
  color: #999;
  display: block;
  margin-top: 4px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.setting-label {
  width: 50px;
  font-size: 14px;
  color: #666;
}

.setting-slider {
  flex: 1;
}

.setting-value {
  width: 40px;
  font-size: 14px;
  color: #667eea;
  text-align: right;
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

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.duration {
  font-size: 12px;
  color: #999;
}

.audio-player {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play-btn {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
}

.play-hint {
  font-size: 12px;
  color: #999;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.scene-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 12px;
  cursor: pointer;
}

.scene-icon {
  font-size: 24px;
}

.scene-name {
  font-size: 11px;
  color: #666;
}
</style>
