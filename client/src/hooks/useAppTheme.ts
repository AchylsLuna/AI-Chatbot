import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem('pulse-ledger-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

const useAppTheme = (forceDark = false) => {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const activeTheme: ThemeMode = forceDark ? 'dark' : theme

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(activeTheme === 'dark' ? 'theme-dark' : 'theme-light')
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(activeTheme === 'dark' ? 'theme-dark' : 'theme-light')
    if (!forceDark) {
      window.localStorage.setItem('pulse-ledger-theme', theme)
    }
  }, [activeTheme, forceDark, theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme: activeTheme, toggleTheme }
}

export default useAppTheme
