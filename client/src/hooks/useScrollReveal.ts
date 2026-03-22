import { useEffect } from 'react'

const isInViewport = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  return rect.top < viewportHeight && rect.bottom > 0
}

const useScrollReveal = (trigger?: unknown) => {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const observedElements = new Set<HTMLElement>()
    let observer: IntersectionObserver | null = null

    const revealElement = (element: HTMLElement) => {
      element.classList.add('is-visible')
      if (observer && observedElements.has(element)) {
        observer.unobserve(element)
        observedElements.delete(element)
      }
    }

    const syncElements = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
      if (!elements.length) return

      if (prefersReducedMotion.matches || typeof IntersectionObserver === 'undefined') {
        elements.forEach(revealElement)
        return
      }

      elements.forEach((element) => {
        if (element.classList.contains('is-visible')) {
          if (observedElements.has(element) && observer) {
            observer.unobserve(element)
            observedElements.delete(element)
          }
          return
        }

        if (isInViewport(element)) {
          revealElement(element)
          return
        }

        if (!observedElements.has(element) && observer) {
          observer.observe(element)
          observedElements.add(element)
        }
      })
    }

    if (!prefersReducedMotion.matches && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              revealElement(entry.target as HTMLElement)
            }
          })
        },
        {
          threshold: 0.05,
          rootMargin: '0px 0px -5% 0px',
        }
      )
    }

    syncElements()

    const mutationObserver = new MutationObserver(() => {
      syncElements()
    })

    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true })
    }

    const fallbackTimeout = window.setTimeout(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).forEach(revealElement)
    }, 1200)

    return () => {
      window.clearTimeout(fallbackTimeout)
      mutationObserver.disconnect()
      observer?.disconnect()
      observedElements.clear()
    }
  }, [trigger])
}

export default useScrollReveal
