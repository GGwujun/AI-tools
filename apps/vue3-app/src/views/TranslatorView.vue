<script setup lang="ts">
import { ref } from 'vue'

const inputText = ref('')
const resultText = ref('')
const isTranslating = ref(false)
const fromLang = ref({ code: 'auto', name: '自动检测' })
const toLang = ref({ code: 'zh', name: '中文' })

const languages = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英文' },
  { code: 'ja', name: '日文' },
  { code: 'ko', name: '韩文' },
  { code: 'fr', name: '法文' },
  { code: 'de', name: '德文' },
  { code: 'es', name: '西班牙文' }
]

const showFromPicker = ref(false)
const showToPicker = ref(false)
const history = ref<any[]>([])

const onInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  inputText.value = target.value
}

const swapLanguages = () => {
  const temp = fromLang.value
  fromLang.value = toLang.value
  toLang.value = temp
}

const selectFrom = (lang: { code: string; name: string }) => {
  fromLang.value = lang
  showFromPicker.value = false
}

const selectTo = (lang: { code: string; name: string }) => {
  toLang.value = lang
  showToPicker.value = false
}

const translate = () => {
  if (!inputText.value.trim()) {
    alert('请输入要翻译的文字')
    return
  }

  isTranslating.value = true

  // Simulate translation
  setTimeout(() => {
    resultText.value = `【翻译结果】

由于浏览器环境无法调用翻译API，这里显示模拟翻译结果。

原文语言：${fromLang.value.name}
目标语言：${toLang.value.name}

在生产环境中，这里会显示真实的翻译结果。`

    // Save to history
    history.value.unshift({
      from: inputText.value.substring(0, 30),
      to: resultText.value.substring(0, 30),
      fromLang: fromLang.value.name,
      toLang: toLang.value.name
    })

    isTranslating.value = false
  }, 1500)
}

const copyResult = () => {
  if (!resultText.value) return
  navigator.clipboard.writeText(resultText.value).then(() => {
    alert('已复制')
  })
}

const clearInput = () => {
  inputText.value = ''
  resultText.value = ''
}

const clearHistory = () => {
  history.value = []
}
</script>

<template>
  <div class="page">
    <!-- 语言选择 -->
    <div class="lang-section">
      <div class="lang-box" @click="showFromPicker = true">
        <span class="lang-label">源语言</span>
        <div class="lang-display">
          <span class="lang-name">{{ fromLang.name }}</span>
          <span class="lang-arrow">▼</span>
        </div>
      </div>
      <div class="swap-btn" @click="swapLanguages">⇄</div>
      <div class="lang-box" @click="showToPicker = true">
        <span class="lang-label">目标语言</span>
        <div class="lang-display">
          <span class="lang-name">{{ toLang.name }}</span>
          <span class="lang-arrow">▼</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-section">
      <textarea
        class="input-text"
        placeholder="请输入要翻译的文字..."
        :value="inputText"
        @input="onInput"
        maxlength="2000"
      ></textarea>
      <div class="input-footer">
        <span class="char-count">{{ inputText.length }}/2000</span>
        <span v-if="inputText" class="clear-btn" @click="clearInput">清空</span>
      </div>
    </div>

    <!-- 翻译按钮 -->
    <button
      class="translate-btn"
      :class="{ loading: isTranslating }"
      :disabled="!inputText || isTranslating"
      @click="translate"
    >
      {{ isTranslating ? '翻译中...' : '🌐 翻译' }}
    </button>

    <!-- 结果区域 -->
    <div v-if="resultText" class="result-section">
      <div class="result-header">
        <span class="result-title">翻译结果</span>
        <span class="copy-btn" @click="copyResult">复制</span>
      </div>
      <div class="result-text">{{ resultText }}</div>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" class="history-section">
      <div class="history-header">
        <span class="history-title">翻译历史</span>
        <span class="clear-btn" @click="clearHistory">清空</span>
      </div>
      <div class="history-list">
        <div
          v-for="(item, index) in history"
          :key="index"
          class="history-item"
          @click="inputText = item.from"
        >
          <div class="history-content">
            <span class="history-from">{{ item.from }}</span>
            <span class="history-arrow">→</span>
            <span class="history-to">{{ item.to }}</span>
          </div>
          <span class="history-lang">{{ item.fromLang }} → {{ item.toLang }}</span>
        </div>
      </div>
    </div>

    <!-- 语言选择器 -->
    <div v-if="showFromPicker || showToPicker" class="picker-mask" @click="showFromPicker = false; showToPicker = false">
      <div class="picker-content" @click.stop>
        <div class="picker-header">
          <span>{{ showFromPicker ? '选择源语言' : '选择目标语言' }}</span>
          <span @click="showFromPicker = false; showToPicker = false">✕</span>
        </div>
        <div class="picker-list">
          <div
            v-for="lang in languages"
            :key="lang.code"
            class="picker-item"
            @click="showFromPicker ? selectFrom(lang) : selectTo(lang)"
          >
            <span class="picker-name">{{ lang.name }}</span>
            <span v-if="(showFromPicker && lang.code === fromLang.code) || (showToPicker && lang.code === toLang.code)" class="picker-check">✓</span>
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
  padding: 16px;
}

.lang-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.lang-box {
  flex: 1;
  background: white;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
}

.lang-label {
  font-size: 12px;
  color: #999;
  display: block;
  margin-bottom: 4px;
}

.lang-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.lang-arrow {
  font-size: 12px;
  color: #ccc;
}

.swap-btn {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
}

.input-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.input-text {
  width: 100%;
  min-height: 120px;
  border: none;
  font-size: 14px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.char-count {
  font-size: 12px;
  color: #999;
}

.clear-btn {
  font-size: 14px;
  color: #667eea;
  cursor: pointer;
}

.translate-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 12px;
}

.translate-btn:disabled {
  opacity: 0.6;
}

.result-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.copy-btn {
  font-size: 14px;
  color: #667eea;
  cursor: pointer;
}

.result-text {
  font-size: 14px;
  color: #333;
  line-height: 1.8;
  white-space: pre-wrap;
}

.history-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.history-item:last-child {
  border-bottom: none;
}

.history-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-from,
.history-to {
  font-size: 14px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-arrow {
  color: #999;
  flex-shrink: 0;
}

.history-lang {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  display: block;
}

.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

.picker-content {
  background: white;
  width: 100%;
  max-height: 60%;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
  font-size: 16px;
  font-weight: 600;
}

.picker-list {
  max-height: 400px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.picker-name {
  font-size: 14px;
  color: #333;
}

.picker-check {
  color: #667eea;
  font-size: 18px;
}
</style>
