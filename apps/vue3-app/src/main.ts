import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setupMock } from './mock/mock'

if (import.meta.env.VITE_ENABLE_SAVE_MOCK === 'true') {
  setupMock()
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
