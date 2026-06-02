import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initPwaInstallPrompt, notifyUpdateAvailable, setPwaUpdateFn } from './utils/pwa'
import { registerSW } from 'virtual:pwa-register'

// Capture beforeinstallprompt early so it isn't missed before React mounts.
initPwaInstallPrompt()

// Register the service worker. Using 'prompt' mode (set in vite.config.js) so
// the app controls when to apply updates rather than reloading automatically.
const updateSW = registerSW({
  onNeedRefresh: notifyUpdateAvailable,
  onOfflineReady: () => {},
})
setPwaUpdateFn(updateSW)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
