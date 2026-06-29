/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_PEXELS_API_KEY: string
  readonly VITE_KAKAO_REST_API_KEY: string
  readonly VITE_KAKAO_JS_KEY: string
  readonly VITE_SHARE_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
