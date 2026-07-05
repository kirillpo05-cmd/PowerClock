import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// data/ is canonical at the repo root (written by the cron pipeline).
// Dev server already serves it from root; for production copy it into dist/.
function copyData(): Plugin {
  return {
    name: 'powerclock:copy-data',
    apply: 'build',
    closeBundle() {
      const src = fileURLToPath(new URL('./data', import.meta.url))
      const dest = fileURLToPath(new URL('./dist/data', import.meta.url))
      if (existsSync(src)) cpSync(src, dest, { recursive: true })
    },
  }
}

export default defineConfig({
  base: '/PowerClock/',
  plugins: [react(), tailwindcss(), copyData()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
