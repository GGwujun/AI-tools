import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

type CategoryKey = 'stock_lof' | 'index_lof' | 'etf' | 'bond'
type RiskKey = 'all' | 'low' | 'mid' | 'high'
type SortKey = 'premium' | 'success' | 'arrival' | 'hot'
type CalendarFilterKey = 'all' | 'arrival' | 'sell' | 'new-bond' | 'redeem'

type FilterState = {
  category: CategoryKey | 'all'
  risk: RiskKey
  sort: SortKey
  status: 'all' | 'subscribable' | 'limited' | 'paused' | 't0'
  cycle: 'all' | 't1' | 't2' | 't3' | 'long'
}

type PersistedState = {
  acceptedNotice: boolean
  homeCategory: CategoryKey
  listCategory: CategoryKey
  watchlistSegment: 'all' | 'fund' | 'bond'
  calendarFilter: CalendarFilterKey
  expandedHistory: boolean
  favorites: string[]
  reminders: string[]
  filters: FilterState
}

const STORAGE_KEY = 'lof-h5-ui-state'

function loadPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

export const useLofH5Store = defineStore('lof-h5', () => {
  const persisted = loadPersisted()

  const acceptedNotice = ref(persisted?.acceptedNotice ?? false)
  const homeCategory = ref<CategoryKey>(persisted?.homeCategory ?? 'stock_lof')
  const listCategory = ref<CategoryKey>(persisted?.listCategory ?? 'stock_lof')
  const watchlistSegment = ref<'all' | 'fund' | 'bond'>(persisted?.watchlistSegment ?? 'all')
  const calendarFilter = ref<CalendarFilterKey>(persisted?.calendarFilter ?? 'all')
  const expandedHistory = ref(persisted?.expandedHistory ?? false)
  const favorites = ref<string[]>(persisted?.favorites ?? ['160629', '123456'])
  const reminders = ref<string[]>(persisted?.reminders ?? ['160629:arrival', '160629:sell', '123456:risk'])
  const filters = ref<FilterState>(
    persisted?.filters ?? {
      category: 'stock_lof',
      risk: 'all',
      sort: 'premium',
      status: 'subscribable',
      cycle: 'all',
    },
  )

  const favoriteSet = computed(() => new Set(favorites.value))
  const reminderSet = computed(() => new Set(reminders.value))

  function toggleFavorite(code: string) {
    favorites.value = favoriteSet.value.has(code)
      ? favorites.value.filter((item) => item !== code)
      : [...favorites.value, code]
  }

  function toggleReminder(key: string) {
    reminders.value = reminderSet.value.has(key)
      ? reminders.value.filter((item) => item !== key)
      : [...reminders.value, key]
  }

  function setAcceptedNotice(value: boolean) {
    acceptedNotice.value = value
  }

  function setHomeCategory(value: CategoryKey) {
    homeCategory.value = value
    listCategory.value = value
    filters.value.category = value
  }

  function setListCategory(value: CategoryKey) {
    listCategory.value = value
    filters.value.category = value
  }

  function patchFilters(payload: Partial<FilterState>) {
    filters.value = {
      ...filters.value,
      ...payload,
    }
  }

  function resetFilters() {
    filters.value = {
      category: listCategory.value,
      risk: 'all',
      sort: 'premium',
      status: 'subscribable',
      cycle: 'all',
    }
  }

  watch(
    [
      acceptedNotice,
      homeCategory,
      listCategory,
      watchlistSegment,
      calendarFilter,
      expandedHistory,
      favorites,
      reminders,
      filters,
    ],
    () => {
      if (typeof window === 'undefined') return
      const state: PersistedState = {
        acceptedNotice: acceptedNotice.value,
        homeCategory: homeCategory.value,
        listCategory: listCategory.value,
        watchlistSegment: watchlistSegment.value,
        calendarFilter: calendarFilter.value,
        expandedHistory: expandedHistory.value,
        favorites: favorites.value,
        reminders: reminders.value,
        filters: filters.value,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    },
    { deep: true },
  )

  return {
    acceptedNotice,
    homeCategory,
    listCategory,
    watchlistSegment,
    calendarFilter,
    expandedHistory,
    favorites,
    reminders,
    favoriteSet,
    reminderSet,
    filters,
    toggleFavorite,
    toggleReminder,
    setAcceptedNotice,
    setHomeCategory,
    setListCategory,
    patchFilters,
    resetFilters,
  }
})
