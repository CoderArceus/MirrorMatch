import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point to engine source files so Vite can process them
      'mirrormatch-engine': '/Users/aryan/Documents/Strategy21/engine/src',
    },
  },
})
