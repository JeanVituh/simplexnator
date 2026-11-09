import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Em desenvolvimento, /api é encaminhado para o FastAPI (porta 8000).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { port: 4173, proxy: { '/api': 'http://127.0.0.1:8000' } },
  // O Plotly é carregado sob demanda (React.lazy) e é o único chunk grande.
  build: { chunkSizeWarningLimit: 5200 },
})
