import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import flowbiteReact from 'flowbite-react/plugin/vite'

// Su GitHub Pages il sito è servito sotto /<nome-repo>/.
// La action passa VITE_BASE="/<nome-repo>/"; in locale resta "/".
const base = process.env['VITE_BASE'] ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), flowbiteReact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
})
