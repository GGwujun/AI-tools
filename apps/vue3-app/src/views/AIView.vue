<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveAiAnalysis, type SaveAiAnalysisResponse } from '@/lib/save-api'

const router = useRouter()
const deviceId = getDeviceId()
const loading = ref(false)
const error = ref('')
const response = ref<SaveAiAnalysisResponse | null>(null)

async function loadAnalysis(tab = 'opportunity') {
  loading.value = true
  error.value = ''
  try {
    response.value = await fetchSaveAiAnalysis(tab, deviceId)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAnalysis()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back()"></button>
      <div class="title">AI 解读</div>
    </header>

    <nav class="tabs">
      <button
        v-for="item in response?.tabs || []"
        :key="item.key"
        :class="{ active: response?.current_tab === item.key }"
        @click="loadAnalysis(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <section class="card article">
      <h2>{{ response?.title || 'AI 机会解读' }}</h2>
      <p v-if="error">{{ error }}</p>
      <p v-else-if="loading">正在加载 AI 解读...</p>
      <p v-else>{{ response?.content }}</p>
      <div class="source">
        <span class="clock"></span>
        <div>
          <strong>{{ response?.source.author || '机角' }}</strong>
          <small>{{ response?.source.time || '今天 09:10' }}</small>
        </div>
        <div class="actions">
          <span>👍 {{ response?.source.likes || 0 }}</span>
          <span>👎 {{ response?.source.dislikes || 0 }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>今日机会关键词</h2>
      <div class="chips">
        <span v-for="item in response?.keywords || []" :key="item">{{ item }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { min-height:100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 0; background: var(--lof-bg); }
.topbar { display:grid; grid-template-columns:18px 1fr 18px; align-items:center; }
.title { text-align:center; font-size:18px; font-weight:700; }
.back { width:18px; height:18px; border:0; background:none; position:relative; }
.back::before { content:''; position:absolute; left:2px; top:7px; width:10px; height:10px; border-left:2px solid #1f3348; border-bottom:2px solid #1f3348; transform:rotate(45deg); }
.tabs { display:flex; gap:18px; margin-top:16px; padding-bottom:10px; overflow:auto; font-size:13px; color:var(--lof-muted); }
.tabs button { border:0; background:none; color:inherit; white-space:nowrap; position:relative; }
.tabs .active { color:var(--lof-primary-deep); font-weight:700; }
.tabs .active::after { content:''; position:absolute; left:0; right:0; bottom:-8px; height:3px; border-radius:999px; background:var(--lof-primary); }
.card { margin-top:14px; padding:16px; border-radius:22px; background:#fff; box-shadow:var(--lof-shadow); }
.article h2, .card h2 { font-size:16px; margin-bottom:12px; }
.article p { font-size:14px; line-height:1.9; color:#43596f; }
.source { display:flex; align-items:center; gap:10px; margin-top:18px; padding:12px; border-radius:16px; background:#f8fbfd; }
.clock { width:24px; height:24px; border:2px solid #8ea0b3; border-radius:50%; position:relative; }
.clock::before { content:''; position:absolute; left:10px; top:4px; width:2px; height:8px; background:#8ea0b3; }
.clock::after { content:''; position:absolute; left:10px; top:10px; width:6px; height:2px; background:#8ea0b3; }
.source strong { display:block; font-size:13px; }
.source small { display:block; margin-top:2px; font-size:11px; color:var(--lof-muted); }
.actions { margin-left:auto; display:flex; gap:12px; font-size:12px; color:var(--lof-muted); }
.chips { display:flex; flex-wrap:wrap; gap:10px; }
.chips span { padding:8px 12px; border-radius:12px; background:#eef8f5; color:var(--lof-primary-deep); font-size:12px; }
</style>
