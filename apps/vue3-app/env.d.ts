/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_SAVE_MOCK?: string
  readonly VITE_FUND_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
