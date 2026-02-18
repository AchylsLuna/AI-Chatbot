import { useEffect } from 'react'

const isInViewport = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  return rect.top < viewportHeight && rect.bottom > 0
}

const useScrollReveal = (trigger?: unknown) => {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!elements.length) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }

    elements.forEach((element) => {
      if (isInViewport(element)) {
        element.classList.add('is-visible')
      }
    })

    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -5% 0px',
      }
    )

    elements.forEach((element) => {
      if (!element.classList.contains('is-visible')) {
        observer.observe(element)
      }
    })

    const fallbackTimeout = window.setTimeout(() => {
      elements.forEach((element) => element.classList.add('is-visible'))
    }, 1200)

    return () => {
      window.clearTimeout(fallbackTimeout)
      observer.disconnect()
    }
  }, [trigger])
}

export default useScrollReveal
