import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchCurrentUser, logoutSession, type AuthUserProfile } from '@/lib/save-api'

const AUTH_USER_KEY = 'vue3-app-auth'
const AUTH_TOKEN_KEY = 'vue3-app-auth-token'

function loadStoredUser(): AuthUserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUserProfile) : null
  } catch {
    return null
  }
}

function loadStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUserProfile | null>(loadStoredUser())
  const token = ref<string | null>(loadStoredToken())
  const isLoggedIn = computed(() => !!user.value && !!token.value)

  function persist(nextUser: AuthUserProfile | null, nextToken: string | null) {
    user.value = nextUser
    token.value = nextToken

    if (nextUser && nextToken) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
      return
    }

    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }

  function setSession(nextUser: AuthUserProfile, nextToken: string) {
    persist(nextUser, nextToken)
  }

  async function refreshMe() {
    if (!token.value) return
    try {
      const response = await fetchCurrentUser()
      persist(response.user, token.value)
    } catch {
      persist(null, null)
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await logoutSession()
      }
    } finally {
      persist(null, null)
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    setSession,
    refreshMe,
    logout,
  }
})
