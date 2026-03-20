import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { buildRouteFromCanonicalPath, normalizePath } from '../config/routing'
import { resolveTabCanonicalPath, type TabPage } from '../config/roleTabRoutes'
import { buildAppRouteState, readAppRouteState } from '../utils/appRouteState'

type SetTabOptions = {
  replace?: boolean
  scroll?: boolean
}

type UseTabRouteStateArgs<TTab extends string> = {
  page: TabPage
  fallbackTab: TTab
  resolveTabFromPath: (path: string) => TTab | null
  getTabPath: (tab: TTab) => string
}

const TAB_ROUTE_CHANGE_EVENT = 'pulse:tab-route-change'

const useTabRouteState = <TTab extends string>({
  page,
  fallbackTab,
  resolveTabFromPath,
  getTabPath,
}: UseTabRouteStateArgs<TTab>) => {
  const notifyRouteChange = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event(TAB_ROUTE_CHANGE_EVENT))
  }, [])

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    window.addEventListener('popstate', onStoreChange)
    window.addEventListener(TAB_ROUTE_CHANGE_EVENT, onStoreChange)
    return () => {
      window.removeEventListener('popstate', onStoreChange)
      window.removeEventListener(TAB_ROUTE_CHANGE_EVENT, onStoreChange)
    }
  }, [])

  const getPathSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return ''
    return window.location.pathname
  }, [])

  const pathname = useSyncExternalStore(subscribe, getPathSnapshot, () => '')
  const activeTab = resolveTabFromPath(pathname) ?? fallbackTab

  const setTab = useCallback(
    (nextTab: TTab, options?: SetTabOptions) => {
      if (typeof window === 'undefined') return

      const targetPath = getTabPath(nextTab)
      if (normalizePath(window.location.pathname) === normalizePath(targetPath)) {
        if (options?.replace) {
          window.history.replaceState(
            buildAppRouteState(page, undefined, readAppRouteState()),
            '',
            buildRouteFromCanonicalPath(targetPath, window.location.search, window.location.hash)
          )
        }
      } else {
        const nextState = buildAppRouteState(page)
        if (options?.replace) {
          window.history.replaceState(
            nextState,
            '',
            buildRouteFromCanonicalPath(targetPath, window.location.search, window.location.hash)
          )
        } else {
          window.history.pushState(
            nextState,
            '',
            buildRouteFromCanonicalPath(targetPath, window.location.search, window.location.hash)
          )
        }
      }

      notifyRouteChange()

      if (options?.scroll !== false) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      }
    },
    [getTabPath, notifyRouteChange, page]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const canonicalPath = resolveTabCanonicalPath(window.location.pathname)
    if (canonicalPath && normalizePath(window.location.pathname) !== normalizePath(canonicalPath)) {
      window.history.replaceState(
        buildAppRouteState(page, undefined, readAppRouteState()),
        '',
        buildRouteFromCanonicalPath(canonicalPath, window.location.search, window.location.hash)
      )
      notifyRouteChange()
    }
  }, [notifyRouteChange, page])

  return { activeTab, setTab }
}

export type { SetTabOptions, UseTabRouteStateArgs }
export default useTabRouteState
