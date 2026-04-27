import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        deck:  resolve(__dirname, 'deck/index.html'),
        data:  resolve(__dirname, 'data/index.html'),
        pdf:   resolve(__dirname, 'pdf/index.html'),
        pitch: resolve(__dirname, 'pitch/index.html'),
      },
    },
  },
})
