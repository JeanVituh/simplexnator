import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Integração real: monta a aplicação e conversa com o FastAPI em execução (VITE_API_URL=http://127.0.0.1:8000).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], include: ['src/test/live/*.test.{ts,tsx}'], testTimeout: 30000 },
})
