import { useEffect, useState } from 'react'
import { applyDarkClass, deviceIsDark, loadThemeMode, onDeviceThemeChange, saveThemeMode } from '../data/themeStorage'
import { THEME_MODES, ThemeMode, isDark, isThemeMode } from '../domain/theme'
import { THEME_LABELS } from './messages'

// Light / dark / match device. The first paint is themed by the script in index.html; this keeps it in sync.
export function ThemeSelect() {
  const [mode, setMode] = useState<ThemeMode>(loadThemeMode)

  // Applies the choice, and follows the device while on "match device".
  useEffect(() => {
    applyDarkClass(isDark(mode, deviceIsDark()))

    if (mode !== ThemeMode.System) {
      return
    }

    return onDeviceThemeChange(applyDarkClass)
  }, [mode])

  function onChange(value: string) {
    if (!isThemeMode(value)) {
      return
    }

    saveThemeMode(value)
    setMode(value)
  }

  // iOS-style segmented control: a radio group, so arrow keys move between options.
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Theme</legend>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-sunk p-1">
        {THEME_MODES.map((m) => (
          <label
            key={m}
            className="cursor-pointer rounded-full px-2 py-1.5 text-center text-sm font-medium text-muted transition has-checked:bg-surface has-checked:text-ink has-checked:shadow-card has-focus-visible:outline-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name="theme"
              value={m}
              className="sr-only"
              checked={mode === m}
              onChange={(e) => onChange(e.target.value)}
            />
            {THEME_LABELS[m]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
