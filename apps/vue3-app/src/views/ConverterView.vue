<script setup lang="ts">
import { ref, computed } from 'vue'

const categories = [
  { id: 'length', name: '长度' },
  { id: 'weight', name: '重量' },
  { id: 'temperature', name: '温度' }
]

const selectedCategory = ref('length')
const fromUnit = ref('m')
const toUnit = ref('cm')
const fromValue = ref('')
const toValue = computed(() => {
  if (!fromValue.value || isNaN(Number(fromValue.value))) return ''
  const conversions: Record<string, Record<string, number>> = {
    length: { m: 1, cm: 100, mm: 1000, km: 0.001, ft: 3.281, in: 39.37 },
    weight: { kg: 1, g: 1000, mg: 1000000, lb: 2.205, oz: 35.27 },
    temperature: { c: 1, f: 1, k: 1 }
  }
  const conv = conversions[selectedCategory.value]
  if (!conv) return ''
  if (selectedCategory.value === 'temperature') {
    const val = Number(fromValue.value)
    if (fromUnit.value === 'c' && toUnit.value === 'f') return ((val * 9/5) + 32).toFixed(2)
    if (fromUnit.value === 'c' && toUnit.value === 'k') return (val + 273.15).toFixed(2)
    if (fromUnit.value === 'f' && toUnit.value === 'c') return ((val - 32) * 5/9).toFixed(2)
    if (fromUnit.value === 'f' && toUnit.value === 'k') return (((val - 32) * 5/9) + 273.15).toFixed(2)
    if (fromUnit.value === 'k' && toUnit.value === 'c') return (val - 273.15).toFixed(2)
    if (fromUnit.value === 'k' && toUnit.value === 'f') return (((val - 273.15) * 9/5) + 32).toFixed(2)
    return val.toFixed(2)
  }
  const result = Number(fromValue.value) * (conv[toUnit.value] / conv[fromUnit.value])
  return result.toFixed(4)
})

const unitOptions = {
  length: [
    { id: 'm', name: '米(m)' },
    { id: 'cm', name: '厘米(cm)' },
    { id: 'mm', name: '毫米(mm)' },
    { id: 'km', name: '千米(km)' },
    { id: 'ft', name: '英尺(ft)' },
    { id: 'in', name: '英寸(in)' }
  ],
  weight: [
    { id: 'kg', name: '千克(kg)' },
    { id: 'g', name: '克(g)' },
    { id: 'mg', name: '毫克(mg)' },
    { id: 'lb', name: '磅(lb)' },
    { id: 'oz', name: '盎司(oz)' }
  ],
  temperature: [
    { id: 'c', name: '摄氏度(°C)' },
    { id: 'f', name: '华氏度(°F)' },
    { id: 'k', name: '开尔文(K)' }
  ]
}

const unitList = computed(() => unitOptions[selectedCategory.value as keyof typeof unitOptions] || [])

const onFromUnitChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  fromUnit.value = target.value
}

const onToUnitChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  toUnit.value = target.value
}

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  fromValue.value = target.value
}

const swapUnits = () => {
  const temp = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = temp
}
</script>

<template>
  <div class="page">
    <!-- 分类选择 -->
    <div class="category-section">
      <div
        v-for="cat in categories"
        :key="cat.id"
        :class="['category-item', { active: selectedCategory === cat.id }]"
        @click="selectedCategory = cat.id; fromUnit = unitOptions[cat.id][0].id; toUnit = unitOptions[cat.id][1].id"
      >
        <span class="category-icon">{{ cat.id === 'length' ? '📏' : cat.id === 'weight' ? '⚖️' : '🌡️' }}</span>
        <span class="category-name">{{ cat.name }}</span>
      </div>
    </div>

    <!-- 换算区域 -->
    <div class="convert-section">
      <div class="convert-box">
        <div class="convert-header">
          <span class="convert-label">从</span>
          <select class="unit-picker" :value="fromUnit" @change="onFromUnitChange">
            <option v-for="unit in unitList" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
          </select>
        </div>
        <input
          class="convert-input"
          type="digit"
          placeholder="请输入数值"
          :value="fromValue"
          @input="onInput"
        />
      </div>

      <div class="swap-btn" @click="swapUnits">⇅</div>

      <div class="convert-box">
        <div class="convert-header">
          <span class="convert-label">到</span>
          <select class="unit-picker" :value="toUnit" @change="onToUnitChange">
            <option v-for="unit in unitList" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
          </select>
        </div>
        <div class="convert-result">
          <span class="result-value">{{ toValue || '0' }}</span>
        </div>
      </div>
    </div>

    <!-- 常用换算 -->
    <div class="quick-section">
      <span class="quick-title">常用换算</span>
      <div class="quick-list">
        <div class="quick-item">1米 = 100厘米</div>
        <div class="quick-item">1千克 = 1000克</div>
        <div class="quick-item">0°C = 32°F</div>
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

.category-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.category-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
}

.category-item.active {
  border-color: #667eea;
  background: #f8f5ff;
}

.category-icon {
  font-size: 24px;
}

.category-name {
  font-size: 14px;
  color: #333;
}

.convert-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
}

.convert-box {
  margin-bottom: 16px;
}

.convert-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.convert-label {
  font-size: 14px;
  color: #666;
  width: 30px;
}

.unit-picker {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  outline: none;
  background: #f5f5f5;
}

.convert-input {
  width: 100%;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  font-size: 18px;
  outline: none;
  box-sizing: border-box;
}

.convert-input:focus {
  border-color: #667eea;
}

.convert-result {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.result-value {
  font-size: 24px;
  font-weight: bold;
  color: white;
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
  margin: 0 auto 16px;
}

.quick-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.quick-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12px;
}

.quick-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-item {
  font-size: 14px;
  color: #666;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.quick-item:last-child {
  border-bottom: none;
}
</style>
