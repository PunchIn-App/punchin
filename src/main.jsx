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

// App-shell height from the JS-measured viewport. On iOS — Safari AND standalone
// — 100vh/100dvh and even a fixed inset:0 element can resolve SHORT of the real
// screen, leaving the bottom nav floating above a strip of page background.
// window.innerHeight is the reliable value; CSS reads it via --app-h, falling back
// to 100dvh before this runs. (Verified on an iPhone simulator: #root height then
// matches innerHeight exactly, so the nav sits flush at the bottom.)
function setAppHeight() {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 150))
