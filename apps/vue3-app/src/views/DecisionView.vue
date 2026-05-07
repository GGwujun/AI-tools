<script setup lang="ts">
import { ref } from 'vue'

const newOption = ref('')
const options = ref<string[]>([])
const result = ref('')
const isDeciding = ref(false)
const history = ref<any[]>([])

const onOptionInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  newOption.value = target.value
}

const addOption = () => {
  if (!newOption.value.trim()) return
  options.value.push(newOption.value.trim())
  newOption.value = ''
}

const removeOption = (index: number) => {
  options.value.splice(index, 1)
}

const makeDecision = () => {
  if (options.value.length < 2) return

  isDeciding.value = true

  setTimeout(() => {
    const randomIndex = Math.floor(Math.random() * options.value.length)
    result.value = options.value[randomIndex]
    isDeciding.value = false

    // Save to history
    history.value.unshift({
      id: Date.now(),
      result: result.value,
      time: new Date().toLocaleString()
    })

    if (history.value.length > 10) history.value.pop()
  }, 1500)
}

const copyResult = () => {
  if (!result.value) return
  navigator.clipboard.writeText(result.value).then(() => {
    alert('已复制')
  })
}

const resetDecision = () => {
  result.value = ''
}

const clearHistory = () => {
  history.value = []
}
</script>

<template>
  <div class="page">
    <!-- 输入选项 -->
    <div class="input-section">
      <span class="section-title">添加选项</span>
      <div class="input-box">
        <input
          class="option-input"
          placeholder="输入一个选项..."
          :value="newOption"
          @input="onOptionInput"
          @keyup.enter="addOption"
        />
        <span class="add-btn" @click="addOption">添加</span>
      </div>
    </div>

    <!-- 选项列表 -->
    <div class="options-section">
      <span class="section-title">选项列表 ({{ options.length }}个)</span>
      <div class="options-list">
        <div v-for="(item, index) in options" :key="index" class="option-item">
          <span class="option-text">{{ item }}</span>
          <span class="option-remove" @click="removeOption(index)">✕</span>
        </div>
      </div>
    </div>

    <!-- 决策按钮 -->
    <button
      class="decide-btn"
      :class="{ loading: isDeciding }"
      :disabled="options.length < 2 || isDeciding"
      @click="makeDecision"
    >
      {{ isDeciding ? '🎲 决策中...' : '🎲 开始决策' }}
    </button>

    <!-- 结果展示 -->
    <div v-if="result" class="result-section">
      <span class="result-title">决策结果</span>
      <div class="result-card">
        <span class="result-icon">🎉</span>
        <span class="result-text">{{ result }}</span>
      </div>
      <div class="result-actions">
        <span class="action-btn" @click="copyResult">复制结果</span>
        <span class="action-btn" @click="resetDecision">重新决策</span>
      </div>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" class="history-section">
      <div class="history-header">
        <span class="section-title">历史记录</span>
        <span class="clear-btn" @click="clearHistory">清空</span>
      </div>
      <div class="history-list">
        <div v-for="item in history" :key="item.id" class="history-item">
          <span class="history-result">{{ item.result }}</span>
          <span class="history-time">{{ item.time }}</span>
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

.input-section,
.options-section,
.result-section,
.history-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12px;
}

.input-box {
  display: flex;
  gap: 12px;
}

.option-input {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  outline: none;
}

.option-input:focus {
  border-color: #667eea;
}

.add-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.option-text {
  font-size: 14px;
  color: #333;
}

.option-remove {
  color: #ff5252;
  cursor: pointer;
  padding: 4px 8px;
}

.decide-btn {
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

.decide-btn:disabled {
  opacity: 0.6;
}

.result-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  margin: 16px 0;
}

.result-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 8px;
}

.result-text {
  font-size: 20px;
  font-weight: bold;
  color: white;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.action-btn {
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-header .section-title {
  margin-bottom: 0;
}

.clear-btn {
  color: #999;
  font-size: 14px;
  cursor: pointer;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.history-item:last-child {
  border-bottom: none;
}

.history-result {
  font-size: 14px;
  color: #333;
}

.history-time {
  font-size: 12px;
  color: #999;
}
</style>
