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
    // Guardrail for the "intentionally small bundle" posture (issue #167):
    // recharts is split out via the lazy AnalyticsView import, so the main chunk
    // sits well under this; a build that pushes any chunk past it (an accidental
    // heavy top-level import) surfaces a warning to investigate.
    chunkSizeWarningLimit: 600,
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
      // Cover the deployed Cloudflare Worker too — it's the GitHub-sync security
      // boundary, so excluding it from coverage gave false assurance (issue #165).
      include: ['src/**/*.{js,jsx}', 'worker/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', '**/*.test.{js,jsx}', 'src/test-setup.js'],
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
      workbox: {
        // The OAuth callback (/oauth/github/callback) must reach the Cloudflare
        // Worker that performs the code→token exchange. Without this denylist
        // the SPA navigation fallback serves the precached index.html for that
        // in-scope navigation, so the Worker never runs and GitHub sync login
        // silently fails inside the installed PWA (issue #79). Let any /oauth/*
        // navigation fall through to the network instead of the app shell.
        navigateFallbackDenylist: [/^\/oauth\//],
      },
      manifest: {
        name: 'PunchIn',
        short_name: 'PunchIn',
        description: 'Precision time tracking for freelancers',
        theme_color: '#0F1117',
        background_color: '#0F1117',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
