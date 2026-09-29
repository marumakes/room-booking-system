import { ThemeMode, isThemeMode } from '../domain/theme'

// Also read by the inline script in index.html, which sets the theme before first paint.
const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

// The saved choice, or "system". Storage can be blocked (private mode), so failures fall back.
export function loadThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isThemeMode(saved) ? saved : ThemeMode.System
  } catch {
    return ThemeMode.System
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    if (mode === ThemeMode.System) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }

    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Choice just won't persist; the page still switches.
  }
}

export function deviceIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

// Calls back when the device switches light/dark. Returns unsubscribe.
export function onDeviceThemeChange(callback: (dark: boolean) => void): () => void {
  const query = window.matchMedia(DARK_QUERY)
  const listener = (event: MediaQueryListEvent) => callback(event.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

// Applies the theme to the page (Tailwind's dark: variant keys off this class).
export function applyDarkClass(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark)
}
