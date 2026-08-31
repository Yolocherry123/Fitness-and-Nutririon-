import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// GitHub project pages: https://yolocherry123.github.io/Fitness-and-Nutririon-/
const githubPagesBase =
  process.env.GITHUB_PAGES === 'true' ? '/Fitness-and-Nutririon-/' : '/'

export default defineConfig({
  base: githubPagesBase,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
