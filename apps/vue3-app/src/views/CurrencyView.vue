<script setup lang="ts">
import { ref, computed } from 'vue'

const amount = ref('100')
const fromCurrency = ref('CNY')
const toCurrency = ref('USD')
const result = computed(() => {
  if (!amount.value || isNaN(Number(amount.value))) return ''
  const currencies: Record<string, number> = {
    CNY: 1,
    USD: 0.138,
    EUR: 0.128,
    JPY: 20.5,
    GBP: 0.11,
    KRW: 182,
    HKD: 1.08,
    TWD: 4.4
  }
  const fromRate = currencies[fromCurrency.value] || 1
  const toRate = currencies[toCurrency.value] || 1
  const rmbAmount = parseFloat(amount.value) / fromRate
  return (rmbAmount * toRate).toFixed(2)
})

const currencies = [
  { code: 'CNY', name: '人民币', symbol: '¥' },
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'KRW', name: '韩元', symbol: '₩' },
  { code: 'HKD', name: '港币', symbol: '$' },
  { code: 'TWD', name: '新台币', symbol: '$' }
]

const fromCurrencyInfo = computed(() => currencies.find(c => c.code === fromCurrency.value))
const toCurrencyInfo = computed(() => currencies.find(c => c.code === toCurrency.value))

const showFromPicker = ref(false)
const showToPicker = ref(false)

const swapCurrency = () => {
  const temp = fromCurrency.value
  fromCurrency.value = toCurrency.value
  toCurrency.value = temp
}

const selectFrom = (code: string) => {
  fromCurrency.value = code
  showFromPicker.value = false
}

const selectTo = (code: string) => {
  toCurrency.value = code
  showToPicker.value = false
}

const onInputAmount = (e: Event) => {
  const target = e.target as HTMLInputElement
  amount.value = target.value
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
    <div class="converter-card">
      <!-- 输入金额 -->
      <div class="input-section">
        <span class="label">金额</span>
        <div class="input-box">
          <input
            type="digit"
            :value="amount"
            @input="onInputAmount"
            class="amount-input"
            placeholder="请输入金额"
          />
        </div>
      </div>

      <!-- 货币选择 -->
      <div class="currency-section">
        <div class="currency-selector" @click="showFromPicker = true">
          <span class="currency-symbol">{{ fromCurrencyInfo?.symbol }}</span>
          <span class="currency-code">{{ fromCurrency }}</span>
          <span class="currency-name">{{ fromCurrencyInfo?.name }}</span>
          <span class="arrow">▼</span>
        </div>

        <div class="swap-btn" @click="swapCurrency">⇄</div>

        <div class="currency-selector" @click="showToPicker = true">
          <span class="currency-symbol">{{ toCurrencyInfo?.symbol }}</span>
          <span class="currency-code">{{ toCurrency }}</span>
          <span class="currency-name">{{ toCurrencyInfo?.name }}</span>
          <span class="arrow">▼</span>
        </div>
      </div>

      <!-- 结果 -->
      <div class="result-section" @click="copyResult">
        <span class="result-label">换算结果</span>
        <span class="result-amount">{{ result || '0.00' }}</span>
        <span class="result-currency">{{ toCurrencyInfo?.name }}</span>
        <span v-if="result" class="copy-hint">点击复制</span>
      </div>
    </div>

    <!-- 货币选择器 -->
    <div v-if="showFromPicker || showToPicker" class="picker-mask" @click="showFromPicker = false; showToPicker = false">
      <div class="picker-content" @click.stop>
        <div class="picker-header">
          <span>选择货币</span>
          <span @click="showFromPicker = false; showToPicker = false">✕</span>
        </div>
        <div class="picker-list">
          <div
            v-for="c in currencies"
            :key="c.code"
            class="picker-item"
            @click="showFromPicker ? selectFrom(c.code) : selectTo(c.code)"
          >
            <span class="picker-symbol">{{ c.symbol }}</span>
            <span class="picker-code">{{ c.code }}</span>
            <span class="picker-name">{{ c.name }}</span>
            <span v-if="(showFromPicker && c.code === fromCurrency) || (showToPicker && c.code === toCurrency)" class="picker-check">✓</span>
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

.converter-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
}

.input-section {
  margin-bottom: 20px;
}

.label {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.input-box {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
}

.amount-input {
  width: 100%;
  border: none;
  font-size: 24px;
  font-weight: bold;
  outline: none;
}

.currency-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.currency-selector {
  flex: 1;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.currency-symbol {
  font-size: 18px;
}

.currency-code {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.currency-name {
  font-size: 11px;
  color: #999;
}

.arrow {
  font-size: 12px;
  color: #ccc;
  margin-top: 4px;
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
  font-size: 18px;
}

.result-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
}

.result-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  display: block;
}

.result-amount {
  font-size: 32px;
  font-weight: bold;
  color: white;
  display: block;
  margin: 8px 0;
}

.result-currency {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  display: block;
}

.copy-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  display: block;
  margin-top: 8px;
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
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.picker-symbol {
  font-size: 18px;
  width: 30px;
}

.picker-code {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  width: 50px;
}

.picker-name {
  flex: 1;
  font-size: 14px;
  color: #666;
}

.picker-check {
  color: #667eea;
  font-size: 18px;
}
</style>
