<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sendLoginCode, loginWithMobileCode } from '@/lib/save-api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const mobile = ref('')
const code = ref('')
const sending = ref(false)
const loggingIn = ref(false)
const error = ref('')
const codeHint = ref('')
const countdown = ref(0)
let timer: number | null = null

const canSendCode = computed(() => /^1\d{10}$/.test(mobile.value) && countdown.value === 0 && !sending.value)

function presentErrorMessage(requestError: unknown, fallback: string) {
  if (!(requestError instanceof Error)) return fallback
  const message = requestError.message
  if (message.includes('invalid_mobile')) return '请输入正确的手机号'
  if (message.includes('invalid_code')) return '验证码不正确或已过期'
  return message || fallback
}

function resolveRedirect() {
  return typeof route.query.redirect === 'string' && route.query.redirect ? route.query.redirect : '/mine'
}

function startCountdown(seconds: number) {
  countdown.value = seconds
  if (timer) window.clearInterval(timer)
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      window.clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(mobile.value)) {
    error.value = '请输入正确的手机号'
    return
  }

  sending.value = true
  error.value = ''
  codeHint.value = ''
  try {
    const response = await sendLoginCode(mobile.value)
    startCountdown(Math.min(response.expires_in_seconds, 60))
    codeHint.value = response.debug_code ? `开发验证码：${response.debug_code}` : response.message
  } catch (requestError) {
    error.value = presentErrorMessage(requestError, '验证码发送失败')
  } finally {
    sending.value = false
  }
}

async function submitLogin() {
  if (!/^1\d{10}$/.test(mobile.value)) {
    error.value = '请输入正确的手机号'
    return
  }
  if (!code.value.trim()) {
    error.value = '请输入验证码'
    return
  }

  loggingIn.value = true
  error.value = ''
  try {
    const response = await loginWithMobileCode(mobile.value, code.value.trim())
    authStore.setSession(response.user, response.token)
    router.replace(resolveRedirect())
  } catch (requestError) {
    error.value = presentErrorMessage(requestError, '登录失败')
  } finally {
    loggingIn.value = false
  }
}

function continueAsGuest() {
  router.replace('/save')
}
</script>

<template>
  <div class="page">
    <div class="panel">
      <h1>登录 / 注册</h1>
      <p>使用手机号验证码完成登录。首次登录会自动创建账号，后续直接登录即可。</p>

      <label class="field">
        <span>手机号</span>
        <input v-model="mobile" type="tel" maxlength="11" placeholder="请输入手机号" />
      </label>

      <label class="field">
        <span>验证码</span>
        <div class="code-row">
          <input v-model="code" type="text" maxlength="6" placeholder="请输入验证码" />
          <button class="code-btn" :disabled="!canSendCode" @click="handleSendCode">
            {{ countdown > 0 ? `${countdown}s` : sending ? '发送中...' : '获取验证码' }}
          </button>
        </div>
      </label>

      <p v-if="error" class="error-text">{{ error }}</p>
      <p v-else-if="codeHint" class="hint-text">{{ codeHint }}</p>

      <button class="primary" @click="submitLogin">{{ loggingIn ? '登录中...' : '登录 / 注册' }}</button>
      <button class="ghost" @click="continueAsGuest">先浏览</button>
      <button class="text-btn" @click="router.back()">返回</button>

      <div class="tips">
        <strong>登录后可用：</strong>
        <span>自选同步、提醒设置、参与记录、偏好设置</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(226, 247, 248, 0.95) 0, rgba(255, 255, 255, 0) 36%),
    linear-gradient(180deg, #fbfdfd 0%, #f4f8fb 100%);
}

.panel {
  width: min(100%, 360px);
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 34px rgba(27, 53, 74, 0.1);
}

.panel h1 {
  color: #15273a;
  font-size: 28px;
  line-height: 36px;
  font-weight: 800;
}

.panel p {
  margin-top: 8px;
  color: #7d8d9d;
  font-size: 13px;
  line-height: 20px;
}

.field {
  display: block;
  margin-top: 18px;
}

.field span {
  display: block;
  margin-bottom: 8px;
  color: #506476;
  font-size: 13px;
}

.field input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 1px solid #dfe7ee;
  border-radius: 14px;
  background: #fff;
  color: #203447;
  font-size: 14px;
}

.code-row {
  display: grid;
  grid-template-columns: 1fr 108px;
  gap: 10px;
}

.code-btn {
  border: 1px solid #dfe7ee;
  border-radius: 14px;
  background: #fff;
  color: #1d3042;
  font-size: 13px;
  font-weight: 700;
}

.code-btn:disabled {
  color: #9aa7b8;
}

.primary,
.ghost {
  width: 100%;
  height: 48px;
  margin-top: 16px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
}

.primary {
  border: 0;
  background: linear-gradient(90deg, #149b88 0%, #1f9f8a 100%);
  color: #fff;
}

.ghost {
  border: 1px solid #dfe7ee;
  background: #fff;
  color: #1d3042;
}

.text-btn {
  width: 100%;
  margin-top: 10px;
  border: 0;
  background: transparent;
  color: #7d8d9d;
  font-size: 13px;
}

.error-text {
  margin-top: 12px;
  color: #dc2626 !important;
}

.hint-text {
  margin-top: 12px;
  color: #10947d !important;
}

.tips {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #eef2f6;
}

.tips strong {
  display: block;
  color: #203447;
  font-size: 12px;
}

.tips span {
  display: block;
  margin-top: 6px;
  color: #7d8d9d;
  font-size: 12px;
  line-height: 18px;
}
</style>
