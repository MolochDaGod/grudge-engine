/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASSETS_URL:        string
  readonly VITE_API_URL:           string
  readonly VITE_ID_URL:            string
  readonly VITE_WS_URL:            string
  readonly VITE_USE_REMOTE_ASSETS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
