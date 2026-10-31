/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The config runs before Vite reads .env files, so API_URL is loaded here: from the shell or from
  // frontend/.env(.local). The '' prefix also loads names without VITE_; none of them reach the browser.
  const env = loadEnv(mode, import.meta.dirname, '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    // The backend's routes already start with /api, so the path is passed on as it is.
    // API_URL points the dev server at another backend (default: `poetry run start` on port 8000).
    server: {
      proxy: {
        '/api': { target: env.API_URL || 'http://localhost:8000', changeOrigin: true },
      },
    },
    // `pnpm test`: unit tests next to the code they test, in Node (no DOM needed so far).
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})
