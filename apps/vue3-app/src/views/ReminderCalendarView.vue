<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getDeviceId } from '@/lib/device'
import { fetchSaveCalendar, type SaveCalendarResponse } from '@/lib/save-api'
import { useLofH5Store } from '@/stores/lofH5'

const lofStore = useLofH5Store()
const deviceId = getDeviceId()
const loading = ref(false)
const error = ref('')
const response = ref<SaveCalendarResponse | null>(null)

async function loadCalendar() {
  loading.value = true
  error.value = ''
  try {
    response.value = await fetchSaveCalendar(lofStore.calendarFilter, deviceId)
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function setFilter(key: 'all' | 'arrival' | 'sell' | 'new-bond' | 'redeem') {
  lofStore.calendarFilter = key
  void loadCalendar()
}

onMounted(() => {
  void loadCalendar()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <span class="title">日历提醒</span>
      <div class="month">{{ response?.month || '日历' }}</div>
    </header>

    <section class="filters">
      <button
        v-for="item in response?.filters || []"
        :key="item.key"
        :class="{ active: lofStore.calendarFilter === item.key }"
        @click="setFilter(item.key as 'all' | 'arrival' | 'sell' | 'new-bond' | 'redeem')"
      >
        {{ item.label }}
      </button>
    </section>

    <section class="calendar">
      <div class="weeknames">
        <span v-for="name in ['日', '一', '二', '三', '四', '五', '六']" :key="name">{{ name }}</span>
      </div>
      <div v-for="(row, index) in response?.weeks || []" :key="index" class="week">
        <span v-for="day in row" :key="`${index}-${day}`" :class="['day', { active: day === response?.markers?.[0]?.day }]">{{ day }}</span>
      </div>
      <div class="legend">
        <span><i class="green"></i>到账</span>
        <span><i class="teal"></i>可申购</span>
        <span><i class="red"></i>机会观察</span>
        <span><i class="orange"></i>申购日</span>
      </div>
    </section>

    <section class="agenda">
      <div class="section-title">{{ response?.events[0]?.date }} {{ response?.events[0]?.weekday }}</div>
      <article v-if="error" class="agenda-item"><div class="content"><strong>{{ error }}</strong></div></article>
      <article v-else-if="loading" class="agenda-item"><div class="content"><strong>正在加载日历...</strong></div></article>
      <article v-for="item in response?.events[0]?.items || []" :key="item.title" class="agenda-item">
        <span :class="['bar', item.accent]"></span>
        <div class="content">
          <strong>{{ item.title }}</strong>
          <p>{{ item.note }}</p>
        </div>
        <span class="time">{{ item.time }}</span>
      </article>
    </section>
  </div>
</template>

<style scoped>
.page { min-height:100vh; padding: calc(14px + env(safe-area-inset-top)) 16px 0; background: var(--lof-bg); }
.topbar { text-align:center; }
.title { display:block; font-size:20px; font-weight:700; }
.month { margin-top:10px; font-size:14px; font-weight:600; color:#44566c; }
.filters { display:flex; gap:8px; margin-top:14px; overflow:auto; }
.filters button { padding:8px 12px; border-radius:12px; border:1px solid var(--lof-border); background:#fff; color:#55697f; white-space:nowrap; }
.filters .active { background:#eef8f5; color:var(--lof-primary-deep); border-color:rgba(20,159,135,.28); }
.calendar, .agenda { margin-top:14px; background:var(--lof-card); border-radius:20px; padding:16px; box-shadow:var(--lof-shadow); }
.weeknames, .week { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; }
.weeknames { color:var(--lof-muted); font-size:11px; margin-bottom:8px; }
.week { margin-top:8px; }
.day { display:flex; align-items:center; justify-content:center; width:32px; height:32px; margin:0 auto; font-size:13px; color:#33465c; border-radius:999px; }
.day.active { background: var(--lof-primary); color:#fff; font-weight:700; }
.legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; font-size:11px; color:var(--lof-muted); }
.legend i { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:4px; }
.green { background:#34c28d; }
.teal { background:#2ab0c1; }
.red { background:#ff6a63; }
.orange { background:#f7a74b; }
.section-title { font-size:14px; font-weight:700; margin-bottom:10px; }
.agenda-item { display:grid; grid-template-columns:4px 1fr auto; gap:10px; align-items:center; padding:12px 0; border-bottom:1px solid var(--lof-border); }
.agenda-item:last-child { border-bottom:0; }
.bar { width:4px; height:32px; border-radius:999px; }
.bar.red { background:#ff6a63; }
.bar.orange { background:#f7a74b; }
.bar.green { background:#27b07d; }
.content strong { display:block; font-size:14px; }
.content p, .time { font-size:11px; color:var(--lof-muted); margin-top:4px; }
</style>
