import { useCallback, useEffect, useState } from 'react'
import {
  buildRoute,
  hasKnownRoute,
  normalizePath,
  resolvePageFromPath,
} from '../config/routing'
import type { AppPage } from '../types/navigation'

type NavigateOptions = {
  replace?: boolean
  scroll?: boolean
}

export type NavigateToPage = (page: AppPage, options?: NavigateOptions) => void

const useAppRouting = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if (typeof window === 'undefined') return 'landing'
    return resolvePageFromPath(window.location.pathname)
  })

  const navigateToPage = useCallback<NavigateToPage>((page, options) => {
    setCurrentPage(page)
    if (typeof window === 'undefined') return
    const target = buildRoute(page)
    const nextPath = normalizePath(target)
    const currentPath = normalizePath(window.location.pathname)
    if (nextPath !== currentPath) {
      if (options?.replace) {
        window.history.replaceState({}, '', target)
      } else {
        window.history.pushState({}, '', target)
      }
    }
    if (options?.scroll !== false) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const resolved = resolvePageFromPath(window.location.pathname)
      setCurrentPage(resolved)
      if (!hasKnownRoute(window.location.pathname)) {
        navigateToPage('landing', { replace: true })
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigateToPage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasKnownRoute(window.location.pathname)) {
      window.history.replaceState({}, '', buildRoute('landing'))
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [])

  const isLanding = currentPage === 'landing'
  const isAuthPage =
    currentPage === 'admin_login' ||
    currentPage === 'login' ||
    currentPage === 'signup' ||
    currentPage === 'forgot_password'

  return { currentPage, navigateToPage, isLanding, isAuthPage }
}

export default useAppRouting
