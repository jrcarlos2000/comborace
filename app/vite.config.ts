import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Real on-chain client + Phantom are opt-in at build time. Off by default so the default bundle
// stays wallet-free and mock-only.
const REAL_CLIENT = process.env.VITE_REAL_CLIENT === 'true';

// Whether "Watch a race" streams from the WebSocket server (the Docker / live-feed build) or
// plays a client-side replay (the static public bundle, which has no server behind it). Off by
// default so a static deploy never claims a feed that is not there; the Dockerfile turns it on.
const LIVE_FEED = process.env.VITE_LIVE_FEED === 'true';

// Where the dev app reaches the match server for the WS feed and static proxy fallback.
const SERVER_ORIGIN = process.env.VITE_SERVER_ORIGIN ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  define: {
    __COMBORACE_REAL_CLIENT__: JSON.stringify(REAL_CLIENT),
    __COMBORACE_LIVE_FEED__: JSON.stringify(LIVE_FEED),
  },
  resolve: {
    alias: {
      '@comborace/sdk/mock': fileURLToPath(new URL('../sdk/dist/mock.js', import.meta.url)),
      '@comborace/sdk': fileURLToPath(new URL('../sdk/dist/index.js', import.meta.url)),
    },
  },
  server: {
    host: true,
    proxy: {
      '/ws': { target: SERVER_ORIGIN, ws: true, changeOrigin: true },
    },
  },
});
