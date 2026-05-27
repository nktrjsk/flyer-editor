import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/flyer-editor/',
  optimizeDeps: {
    exclude: ['@evolu/sqlite-wasm', 'kysely', '@evolu/react-web'],
  },
})
