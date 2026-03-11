import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildRoute,
  buildRouteFromCanonicalPath,
  hasKnownRoute,
  normalizePath,
  resolveCanonicalPath,
  resolvePageFromPath,
} from '../config/routing'
import type { AppPage } from '../types/navigation'

type NavigateOptions = {
  replace?: boolean
  scroll?: boolean
  path?: string
}

export type NavigateToPage = (page: AppPage, options?: NavigateOptions) => void
type NavigateBack = (fallback?: AppPage) => void

const stripSensitiveSearchParams = (search: string) => {
  if (!search) return search
  const params = new URLSearchParams(search)
  const sensitiveKeys = ['token', 'access_token', 'id_token']
  let changed = false

  for (const key of sensitiveKeys) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }

  if (!changed) return search
  const next = params.toString()
  return next ? `?${next}` : ''
}

const useAppRouting = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if (typeof window === 'undefined') return 'landing'
    return resolvePageFromPath(window.location.pathname)
  })
  const routeStackRef = useRef<AppPage[]>([currentPage])

  const syncRouteStack = useCallback((page: AppPage, replace = false) => {
    const stack = routeStackRef.current
    const lastPage = stack[stack.length - 1]

    if (replace) {
      if (stack.length === 0) {
        stack.push(page)
      } else {
        stack[stack.length - 1] = page
      }
      return
    }

    if (lastPage !== page) {
      stack.push(page)
    }
  }, [])

  const navigateToPage = useCallback<NavigateToPage>((page, options) => {
    setCurrentPage(page)
    syncRouteStack(page, Boolean(options?.replace))

    if (typeof window === 'undefined') return

    const requestedPath = options?.path
      ? resolveCanonicalPath(options.path)
      : normalizePath(buildRoute(page))
    const nextPath =
      resolvePageFromPath(requestedPath) === page
        ? requestedPath
        : normalizePath(buildRoute(page))
    const target = buildRouteFromCanonicalPath(nextPath)
    const currentPath = normalizePath(window.location.pathname)
    const state = { appRoute: true, appPage: page }

    if (nextPath !== currentPath) {
      if (options?.replace) {
        window.history.replaceState(state, '', target)
      } else {
        window.history.pushState(state, '', target)
      }
    } else if (options?.replace) {
      window.history.replaceState(state, '', target)
    }

    if (options?.scroll !== false) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [syncRouteStack])

  const navigateBack = useCallback<NavigateBack>(
    (fallback = 'landing') => {
      const stack = routeStackRef.current
      if (stack.length > 1) {
        const previousPage = stack[stack.length - 2]
        stack.pop()
        navigateToPage(previousPage, { replace: true })
        return
      }

      navigateToPage(fallback, { replace: true })
    },
    [navigateToPage]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      if (!hasKnownRoute(window.location.pathname)) {
        navigateToPage('landing', { replace: true })
        return
      }

      const resolved = resolvePageFromPath(window.location.pathname)
      const canonicalPath = resolveCanonicalPath(window.location.pathname)
      const currentPath = normalizePath(window.location.pathname)
      const sanitizedSearch = stripSensitiveSearchParams(window.location.search)
      if (canonicalPath !== currentPath || sanitizedSearch !== window.location.search) {
        window.history.replaceState(
          { ...(window.history.state ?? {}), appRoute: true, appPage: resolved },
          '',
          buildRouteFromCanonicalPath(canonicalPath, sanitizedSearch, window.location.hash)
        )
      }
      setCurrentPage(resolved)
      const stack = routeStackRef.current
      const secondToLast = stack[stack.length - 2]
      const last = stack[stack.length - 1]

      if (secondToLast === resolved) {
        stack.pop()
      } else if (last !== resolved) {
        stack.push(resolved)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigateToPage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canonicalPath = resolveCanonicalPath(window.location.pathname)
    const resolvedPage = resolvePageFromPath(canonicalPath)

    if (!hasKnownRoute(window.location.pathname)) {
      window.history.replaceState(
        { appRoute: true, appPage: 'landing' },
        '',
        buildRoute('landing')
      )
      routeStackRef.current = ['landing']
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }

    const sanitizedSearch = stripSensitiveSearchParams(window.location.search)
    window.history.replaceState(
      { ...(window.history.state ?? {}), appRoute: true, appPage: resolvedPage },
      '',
      buildRouteFromCanonicalPath(canonicalPath, sanitizedSearch, window.location.hash)
    )
    routeStackRef.current = [resolvedPage]
  }, [])

  const isLanding = currentPage === 'landing'
  const isAuthPage =
    currentPage === 'admin_login' ||
    currentPage === 'doctor_login' ||
    currentPage === 'login' ||
    currentPage === 'otp' ||
    currentPage === 'signup' ||
    currentPage === 'doctor_signup' ||
    currentPage === 'forgot_password'

  return { currentPage, navigateToPage, navigateBack, isLanding, isAuthPage }
}

export default useAppRouting
