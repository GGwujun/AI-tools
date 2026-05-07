<script setup lang="ts">
import { ref } from 'vue'

const inputText = ref('')
const qrCodeUrl = ref('')
const scanResult = ref('')

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  inputText.value = target.value
}

const generateQR = () => {
  if (!inputText.value.trim()) {
    alert('请输入内容')
    return
  }
  // Using a free QR code API
  qrCodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inputText.value)}`
}

const saveQR = () => {
  if (!qrCodeUrl.value) return
  // In browser environment, we can open the image in new tab
  window.open(qrCodeUrl.value, '_blank')
}

const scanQR = () => {
  alert('浏览器环境无法调用摄像头，请手动输入内容生成二维码')
}
</script>

<template>
  <div class="page">
    <div class="card">
      <span class="card-title">生成二维码</span>
      <div class="form">
        <input
          class="form-input"
          placeholder="请输入文字或链接"
          :value="inputText"
          @input="onInput"
        />
        <button class="form-btn" @click="generateQR">生成二维码</button>
      </div>
      <div v-if="qrCodeUrl" class="output">
        <img :src="qrCodeUrl" class="output-img" alt="二维码" />
        <button class="output-btn" @click="saveQR">在新窗口打开</button>
      </div>
    </div>

    <div class="card">
      <span class="card-title">扫描二维码</span>
      <button class="form-btn" @click="scanQR">开始扫描</button>
      <div v-if="scanResult" class="output">
        <div class="output-text">{{ scanResult }}</div>
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

.form {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.form-input {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  outline: none;
}

.form-input:focus {
  border-color: #667eea;
}

.form-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.output {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.output-img {
  width: 200px;
  height: 200px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.output-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

.output-text {
  font-size: 14px;
  color: #333;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  word-break: break-all;
}
</style>
