import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { noiseSuppressionAudioWorkletVitePlugin } from '@workadventure/noise-suppression/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), noiseSuppressionAudioWorkletVitePlugin()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
