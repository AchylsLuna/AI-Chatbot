import { useEffect, useState } from 'react'
import { api } from '../services/api'

type ThemeMode = 'light' | 'dark'
const THEME_STORAGE_KEY = 'pulse-ledger-theme-mode'

const resolveStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

const useAppTheme = (authUserKey: string | null) => {
  const [themeByUser, setThemeByUser] = useState<Record<string, ThemeMode>>({})
  const [fallbackTheme, setFallbackTheme] = useState<ThemeMode>(() => resolveStoredTheme())
  const activeTheme: ThemeMode = authUserKey ? themeByUser[authUserKey] ?? fallbackTheme : fallbackTheme

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(activeTheme === 'dark' ? 'theme-dark' : 'theme-light')
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(activeTheme === 'dark' ? 'theme-dark' : 'theme-light')
    window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme)
  }, [activeTheme])

  useEffect(() => {
    if (!authUserKey) return

    let isMounted = true
    ;(async () => {
      try {
        const settings = await api.getUserSettings()
        if (!isMounted) return
        const resolvedTheme: ThemeMode = settings.theme === 'dark' ? 'dark' : 'light'
        setThemeByUser((previous) => ({
          ...previous,
          [authUserKey]: resolvedTheme,
        }))
        setFallbackTheme(resolvedTheme)
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load theme settings. Defaulting to light mode.', error)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [authUserKey])

  const toggleTheme = async () => {
    const previousTheme = authUserKey ? themeByUser[authUserKey] ?? fallbackTheme : fallbackTheme
    const nextTheme: ThemeMode = previousTheme === 'dark' ? 'light' : 'dark'

    setFallbackTheme(nextTheme)
    if (!authUserKey) return

    setThemeByUser((previous) => ({ ...previous, [authUserKey]: nextTheme }))

    try {
      await api.updateUserSettings({ theme: nextTheme })
    } catch (error) {
      console.error('Failed to persist theme preference.', error)
      setFallbackTheme(previousTheme)
      setThemeByUser((previous) => ({ ...previous, [authUserKey]: previousTheme }))
    }
  }

  return { theme: activeTheme, toggleTheme }
}

export default useAppTheme
