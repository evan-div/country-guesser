/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true },
  preview: { host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
