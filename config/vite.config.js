import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// All paths anchored to this config file's directory (config/) so they are
// independent of Vite's root option and the process working directory.
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'))

export default defineConfig({
  // index.html lives in app/. Vite's workspace-root detection walks up from
  // app/ to find package.json, so src/ and node_modules remain reachable.
  root: './app',
  build: {
    outDir: '../dist',   // relative to root (app/) → resolves to project root/dist
    emptyOutDir: true,
  },
  css: {
    postcss: fileURLToPath(new URL('./postcss.config.js', import.meta.url)),
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    // Absolute path so Vitest resolves test files and coverage from the real
    // source tree rather than the app/ subdirectory.
    root: projectRoot,
    environment: 'jsdom',
    globals: true,
    setupFiles: [fileURLToPath(new URL('../src/test-setup.js', import.meta.url))],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/**/*.test.{js,jsx}', 'src/test-setup.js', 'src/sync/**'],
      thresholds: {
        lines: 88,
        functions: 77,
        branches: 71,
        statements: 82,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'PunchIn',
        short_name: 'PunchIn',
        description: 'Precision time tracking for freelancers',
        theme_color: '#0F1117',
        background_color: '#0F1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
