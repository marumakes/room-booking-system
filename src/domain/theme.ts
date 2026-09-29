// Light, dark, or follow the device setting.
export const ThemeMode = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode]

export const THEME_MODES: readonly ThemeMode[] = [ThemeMode.System, ThemeMode.Light, ThemeMode.Dark]

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode)
}

// Whether the page should be dark for this mode and device setting.
export function isDark(mode: ThemeMode, deviceIsDark: boolean): boolean {
  if (mode === ThemeMode.System) {
    return deviceIsDark
  }

  return mode === ThemeMode.Dark
}
