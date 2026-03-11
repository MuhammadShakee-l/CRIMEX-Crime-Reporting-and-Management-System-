import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // listen on all addresses (127.0.0.1, localhost, LAN IP)
    strictPort: false // allow Vite to pick the next free port if the default is taken
    // do not hardcode port; Vite starts on 5173 or the next available
  },
  preview: {
    host: true,
    strictPort: false
  }
})