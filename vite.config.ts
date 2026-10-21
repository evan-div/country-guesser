/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const stub = (file: string) => fileURLToPath(new URL(`./src/vendor/${file}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // three-globe imports h3-js (hexagon layers) and the WebGPU renderer + TSL (heatmap
    // layer) — features this game never uses. Stubbing them saves ~1 MB of JavaScript.
    alias: [
      { find: /^h3-js$/, replacement: stub('h3-stub.ts') },
      { find: /^three\/(webgpu|tsl)$/, replacement: stub('three-webgpu-stub.ts') },
    ],
  },
  // Pre-bundle the lazily loaded globe stack so the dev server never reloads mid-session.
  optimizeDeps: {
    include: [
      'react-globe.gl',
      'three',
      'three-conic-polygon-geometry',
      'three/examples/jsm/lines/LineSegments2.js',
      'three/examples/jsm/lines/LineSegmentsGeometry.js',
      'three/examples/jsm/lines/LineMaterial.js',
      'd3-geo',
      'topojson-client',
    ],
  },
  server: { host: true },
  preview: { host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
