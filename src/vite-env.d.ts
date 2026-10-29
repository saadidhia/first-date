/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Google Ad Manager / AdSense-for-games publisher id (e.g. "ca-pub-…") for the rewarded report ad.
  // Leave unset to keep the report ungated (no ad).
  readonly VITE_ADSENSE_CLIENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
