import '@testing-library/jest-dom'

// ── Web Storage: put jsdom's implementation back on the global scope ─────────
// Node 25+ defines its own `localStorage` / `sessionStorage` globals, which are
// inert unless the process was started with --localstorage-file: reading one
// yields `undefined` and an ExperimentalWarning. Vitest's jsdom environment
// populates the global scope via `getWindowKeys`, which SKIPS every key already
// present on `globalThis` unless it is in Vitest's own KEYS allowlist — and the
// storage keys are not in that list. So on Node >= 25 jsdom's working
// `localStorage` never reaches the global scope, Node's dud shadows it, and
// every module reading bare `localStorage` (src/utils/deviceId.js) dies with
// "Cannot read properties of undefined".
//
// The jsdom Window still holds a real Storage; it is just no longer what
// `window` resolves to (Vitest points `window` and `document.defaultView` at the
// merged global). Reach it through the document's implementation and re-publish
// its storage objects. Using jsdom's genuine instances — rather than a hand-made
// stub — keeps them instances of the global `Storage`, so a test that stubs
// `Storage.prototype.getItem` to simulate a storage failure still intercepts
// them.
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const jsdomWindow = Object.getOwnPropertySymbols(document)
    .map((s) => document[s])
    .find((impl) => impl && impl._defaultView)?._defaultView

  for (const key of ['localStorage', 'sessionStorage']) {
    const storage = jsdomWindow?.[key]
    if (storage) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: storage,
      })
    }
  }
}

// jsdom does not implement window.matchMedia. Provide a minimal stub so any
// component that calls it (e.g. usePlatformContext) doesn't crash in tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
