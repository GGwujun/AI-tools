import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // AI statistics
  const aiStats = ref({
    aiWrites: 0,
    aiOcr: 0,
    aiErase: 0,
    aiTts: 0
  })

  // Load stats from localStorage
  const loadStats = () => {
    const saved = localStorage.getItem('aiStats')
    if (saved) {
      aiStats.value = JSON.parse(saved)
    }
  }

  // Update stats
  const updateStats = (type: 'aiWrites' | 'aiOcr' | 'aiErase' | 'aiTts') => {
    aiStats.value[type]++
    localStorage.setItem('aiStats', JSON.stringify(aiStats.value))
  }

  // Initialize
  loadStats()

  return {
    aiStats,
    loadStats,
    updateStats
  }
})
