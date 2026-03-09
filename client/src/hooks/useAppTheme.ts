import { useEffect, useState } from 'react'
import { api } from '../services/api'

type ThemeMode = 'light' | 'dark'

const useAppTheme = (authUserKey: string | null) => {
  const [themeByUser, setThemeByUser] = useState<Record<string, ThemeMode>>({})
  const activeTheme: ThemeMode = authUserKey ? themeByUser[authUserKey] ?? 'light' : 'light'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(activeTheme === 'dark' ? 'theme-dark' : 'theme-light')
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(activeTheme === 'dark' ? 'theme-dark' : 'theme-light')
  }, [activeTheme])

  useEffect(() => {
    if (!authUserKey) return

    let isMounted = true
    ;(async () => {
      try {
        const settings = await api.getUserSettings()
        if (!isMounted) return
        setThemeByUser((previous) => ({
          ...previous,
          [authUserKey]: settings.theme === 'dark' ? 'dark' : 'light',
        }))
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
    if (!authUserKey) return

    const previousTheme = themeByUser[authUserKey] ?? 'light'
    const nextTheme: ThemeMode = previousTheme === 'dark' ? 'light' : 'dark'
    setThemeByUser((previous) => ({ ...previous, [authUserKey]: nextTheme }))

    try {
      await api.updateUserSettings({ theme: nextTheme })
    } catch (error) {
      console.error('Failed to persist theme preference.', error)
      setThemeByUser((previous) => ({ ...previous, [authUserKey]: previousTheme }))
    }
  }

  return { theme: activeTheme, toggleTheme }
}

export default useAppTheme
