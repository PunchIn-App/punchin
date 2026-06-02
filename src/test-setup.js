import '@testing-library/jest-dom'

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
