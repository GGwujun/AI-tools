<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDeviceId } from '@/lib/device'
import { fetchSaveFilterOptions, type SaveFilterOptionsResponse } from '@/lib/save-api'
import { useLofH5Store } from '@/stores/lofH5'

const router = useRouter()
const deviceId = getDeviceId()
const lofStore = useLofH5Store()
const loading = ref(false)
const response = ref<SaveFilterOptionsResponse | null>(null)

async function loadOptions() {
  loading.value = true
  try {
    response.value = await fetchSaveFilterOptions(deviceId)
  } finally {
    loading.value = false
  }
}

function confirmFilter() {
  router.push('/save/arbitrage')
}

onMounted(() => {
  void loadOptions()
})
</script>

<template>
  <div class="page">
    <header class="header">
      <span class="title">筛选条件</span>
      <button class="reset" @click="lofStore.resetFilters()">重置</button>
    </header>

    <section v-for="group in response?.groups || []" :key="group.title" class="group">
      <h3>{{ group.title }}</h3>
      <div class="chips">
        <button v-for="option in group.options" :key="option" :class="['chip', { active: group.selected.includes(option) }]">
          {{ option }}
        </button>
      </div>
    </section>

    <section class="group">
      <h3>排序方式</h3>
      <div class="select">{{ response?.selected_sort || '溢价率（从高到低）' }}</div>
    </section>

    <footer class="footer">
      <button class="ghost" @click="router.back()">取消</button>
      <button class="primary" @click="confirmFilter">{{ loading ? '加载中...' : '确认筛选（28）' }}</button>
    </footer>
  </div>
</template>

<style scoped>
.page { min-height:100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 96px; background:#fff; }
.header, .footer { display:flex; align-items:center; justify-content:space-between; }
.title { font-size:20px; font-weight:700; }
.reset { border:0; background:none; color:#5f7389; }
.group { margin-top:18px; }
.group h3 { font-size:14px; margin-bottom:12px; }
.chips { display:flex; flex-wrap:wrap; gap:10px; }
.chip { min-width:60px; padding:9px 14px; border:1px solid var(--lof-border); border-radius:12px; background:#fff; color:#465a6f; }
.chip.active { background: rgba(20, 159, 135, 0.1); border-color: rgba(20, 159, 135, 0.36); color: var(--lof-primary-deep); font-weight:700; }
.select { padding:12px 14px; border:1px solid var(--lof-border); border-radius:12px; color:#55697f; }
.footer { position:fixed; left:0; right:0; bottom:0; gap:12px; padding:14px 16px calc(14px + env(safe-area-inset-bottom)); background:rgba(255,255,255,.95); border-top:1px solid var(--lof-border); }
.footer button { flex:1; height:46px; border-radius:14px; border:1px solid var(--lof-border); }
.ghost { background:#fff; }
.primary { background: linear-gradient(180deg, #16ac93 0%, #10947d 100%); color:#fff; border:0; font-weight:700; }
</style>
