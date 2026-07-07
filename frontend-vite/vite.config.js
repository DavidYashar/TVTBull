import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,                       // listen on all network interfaces
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', 'localhost'],
  },
})
