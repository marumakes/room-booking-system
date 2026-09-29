import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Integration tests run in Node, without a DOM; everything below is for jsdom tests only.
const hasDom = typeof window !== 'undefined'

// jsdom has no matchMedia; report a light-mode device unless a test says otherwise.
if (hasDom) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
}

// Unmount rendered components and reset theme state between tests.
afterEach(() => {
  if (!hasDom) {
    return
  }

  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
