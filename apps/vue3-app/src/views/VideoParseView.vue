<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const inputUrl = ref('')
const loading = ref(false)
const showPopup = ref(true)
const config = ref<any>(null)

const platforms = [
  { icon: '🎵', name: '抖音' },
  { icon: '🌐', name: 'TikTok' },
  { icon: '📺', name: '快手' },
  { icon: '🎬', name: '哔哩哔哩' }
]

const steps = [
  '复制视频分享链接',
  '粘贴到上方输入框',
  '点击解析按钮',
  '下载无水印视频'
]

onMounted(() => {
  fetchConfig()
  setTimeout(() => {
    showPopup.value = false
  }, 5000)
})

const fetchConfig = async () => {
  try {
    const res = await fetch('/ymq/')
    const data = await res.json()
    config.value = data.data
  } catch (e) {
    console.error('获取配置失败', e)
  }
}

const closePopup = () => {
  showPopup.value = false
}

// 将远程API地址转换为本地代理地址
const toProxyUrl = (url: string): string => {
  console.log('toProxyUrl input:', url)
  if (!url) return url
  // 如果是 dsx-family.site 的地址，转换为代理路径
  if (url.includes('dsx-family.site')) {
    const result = url.replace('https://dsx-family.site', '')
    console.log('dsx-family.site matched, result:', result)
    return result
  }
  // 如果是 wtf.dsx-family.site 的地址，转换为代理路径
  if (url.includes('wtf.dsx-family.site')) {
    const result = url.replace('https://wtf.dsx-family.site', '/wtf-api')
    console.log('wtf.dsx-family.site matched, result:', result)
    return result
  }
  console.log('No match, returning original URL')
  return url
}

const onInputUrl = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  inputUrl.value = target.value
}

const onClear = () => {
  inputUrl.value = ''
}

const findUrl = (str: string): string[] => {
  const regex = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g
  return str.match(regex) || []
}

const onParse = async (url: string) => {
  if (!url) {
    alert('请输入链接')
    return
  }

  if (!config.value) {
    alert('配置加载中，请稍后重试')
    return
  }

  loading.value = true

  try {
    const { slave_addr, data_field, code_field, code_num } = config.value

    const platform = url.includes('douyin') ? 'douyin' :
                    url.includes('tiktok') ? 'tiktok' : null

    if (!platform) {
      alert('请输入正确的视频分享链接')
      loading.value = false
      return
    }

    const response = await fetch(toProxyUrl(`${slave_addr}${encodeURIComponent(url)}`))
    const res = await response.json()

    const Data = res[data_field]
    const Code = res[code_field]
    const codeNumStr = String(code_num)

    if (Data && (String(Code) === codeNumStr)) {
      const aweme_type = Data.aweme_type
      const url_type_code_dict: Record<number, string> = {
        0: 'video', 2: 'image', 4: 'video', 68: 'image',
        51: 'video', 55: 'video', 58: 'video', 61: 'video', 150: 'image'
      }
      const url_type = url_type_code_dict[aweme_type] || 'video'
      let resultData: any = {}

      if (url_type === 'video') {
        if (platform === 'douyin') {
          resultData = {
            title: Data.desc,
            photo: Data.video.cover.url_list[0],
            videourl: url,
            downurl: Data.video.play_addr.url_list[0].replace('playwm', 'play'),
          }
        } else if (platform === 'tiktok') {
          resultData = {
            title: Data.desc,
            photo: Data.video.cover.url_list[0],
            videourl: url,
            downurl: Data.video?.bit_rate?.[0]?.play_addr?.url_list?.[0],
          }
        }
      } else if (url_type === 'image') {
        if (platform === 'douyin') {
          const pics = Data?.images?.map((image: any) => image['url_list'][0]) ?? []
          resultData = {
            title: Data.desc,
            photo: Data.video.cover.url_list[0],
            pics: pics,
          }
        } else if (platform === 'tiktok') {
          const pics = Data?.image_post_info?.images?.map((image: any) => image?.['display_image']?.url_list?.[0]) ?? []
          resultData = {
            title: Data.desc,
            photo: Data.video.cover.url_list[0],
            pics: pics,
          }
        }
      }

      router.push({
        path: '/video',
        query: { data: encodeURIComponent(JSON.stringify(resultData)) }
      })
    } else {
      alert(res.data?.msg || '解析失败')
    }
  } catch (err) {
    console.error('解析失败', err)
    alert('网络请求失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const onPasteAndParse = async () => {
  const urls = findUrl(inputUrl.value)

  if (urls && urls.length === 1 && urls[0]) {
    onParse(urls[0])
  } else if (urls && urls.length > 1) {
    alert('目前不支持解析多个视频链接')
    return
  } else {
    try {
      const clipboardData = await navigator.clipboard.readText()
      if (clipboardData) {
        inputUrl.value = clipboardData
        const urls2 = findUrl(clipboardData)
        if (urls2 && urls2.length === 1 && urls2[0]) {
          onParse(urls2[0])
        } else if (urls2 && urls2.length > 1) {
          alert('目前不支持解析多个视频链接')
        } else {
          alert('未检测到有效视频链接')
        }
      } else {
        alert('剪贴板为空')
      }
    } catch (err) {
      alert('获取剪贴板失败')
    }
  }
}
</script>

<template>
  <div class="page">
    <!-- 提示弹窗 -->
    <div v-if="showPopup" class="popup-overlay" @click="closePopup">
      <div class="popup-content" @click.stop>
        <div class="popup-icon">🎬</div>
        <div class="popup-title">视频去水印教程</div>
        <div class="popup-steps">
          <div class="popup-step">1. 打开抖音/TikTok App</div>
          <div class="popup-step">2. 找到要下载的视频</div>
          <div class="popup-step">3. 点击分享 → 复制链接</div>
          <div class="popup-step">4. 粘贴到下方并解析</div>
        </div>
        <div class="popup-hint">点击任意处关闭</div>
      </div>
    </div>

    <!-- 提示区 -->
    <div class="tips-card">
      <span class="tips-icon">🎬</span>
      <div class="tips-content">
        <span class="tips-title">视频去水印</span>
        <span class="tips-desc">粘贴抖音、TikTok等视频链接，一键解析无水印下载</span>
      </div>
    </div>

    <div class="content">
      <!-- 输入区域 -->
      <div class="card">
        <textarea
          class="input-box"
          placeholder="请粘贴视频链接，支持抖音和TikTok"
          :value="inputUrl"
          @input="onInputUrl"
          maxlength="500"
        ></textarea>
        <div class="input-actions">
          <button class="paste-btn" @click="onPasteAndParse" :disabled="loading">
            {{ loading ? '解析中...' : '📋 粘贴解析' }}
          </button>
          <span class="clear-btn" @click="onClear">清空</span>
        </div>
      </div>

      <!-- 支持平台 -->
      <div class="card">
        <span class="card-title">支持的平台</span>
        <div class="platform-list">
          <div v-for="p in platforms" :key="p.name" class="platform-item">
            <span class="platform-icon">{{ p.icon }}</span>
            <span class="platform-name">{{ p.name }}</span>
          </div>
        </div>
      </div>

      <!-- 使用说明 -->
      <div class="card">
        <span class="card-title">使用说明</span>
        <div class="steps">
          <div v-for="(step, index) in steps" :key="index" class="step-item">
            <span class="step-num">{{ index + 1 }}</span>
            <span class="step-text">{{ step }}</span>
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
}

.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin: 20px;
  max-width: 320px;
  text-align: center;
}

.popup-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 16px;
}

.popup-steps {
  text-align: left;
  margin-bottom: 16px;
}

.popup-step {
  font-size: 14px;
  color: #666;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.popup-step:last-child {
  border-bottom: none;
}

.popup-hint {
  font-size: 12px;
  color: #999;
  margin-top: 12px;
}

.tips-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.tips-icon {
  font-size: 32px;
}

.tips-content {
  display: flex;
  flex-direction: column;
}

.tips-title {
  font-size: 18px;
  font-weight: bold;
}

.tips-desc {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
}

.content {
  padding: 16px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.input-box {
  width: 100%;
  min-height: 100px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.input-box:focus {
  border-color: #667eea;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.paste-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

.paste-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-btn {
  color: #999;
  font-size: 14px;
  cursor: pointer;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12px;
}

.platform-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.platform-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.platform-icon {
  width: 44px;
  height: 44px;
  background: #f5f5f5;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.platform-name {
  font-size: 12px;
  color: #666;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-num {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.step-text {
  font-size: 14px;
  color: #666;
}
</style>
