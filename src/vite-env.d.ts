/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
  /** Build-time hash of the generated response headers, including the CSP. */
  readonly VITE_DEPLOYMENT_POLICY_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
