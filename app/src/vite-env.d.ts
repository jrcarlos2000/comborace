/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_SOLANA_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-time toggle injected by vite.config.ts. `true` compiles in the Phantom wallet and the
// real on-chain client; `false` (the default) ships the wallet-free mock-only bundle.
declare const __COMBORACE_REAL_CLIENT__: boolean;
