import type { ReactNode } from 'react'

export type NavLink = {
  label: string
  href: string
  onClick?: () => void
}

export type NavAction = {
  label: string
  href: string
  onClick?: () => void
}

type NavBarProps = {
  brand: ReactNode
  links: NavLink[]
  cta?: NavAction
}

export function NavBar({ brand, links, cta }: NavBarProps) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 py-6">
      <div className="flex items-center gap-3">{brand}</div>
      <div className="flex flex-1 flex-wrap items-center justify-center gap-5 text-[15px] font-semibold text-slate/90">
        {links.map((link) => (
          link.onClick ? (
            <button
              key={link.label}
              className="transition hover:text-slate cursor-pointer"
              onClick={link.onClick}
            >
              {link.label}
            </button>
          ) : (
            <a key={link.label} className="transition hover:text-slate" href={link.href}>
              {link.label}
            </a>
          )
        ))}
      </div>
      {cta ? (
        cta.onClick ? (
          <button
            className="inline-flex min-w-[148px] items-center justify-center rounded-[14px] bg-denim px-4 py-3 text-sm font-bold text-white shadow-nav-btn transition hover:-translate-y-0.5 hover:shadow-lg"
            onClick={cta.onClick}
          >
            {cta.label}
          </button>
        ) : (
          <a
            className="inline-flex min-w-[148px] items-center justify-center rounded-[14px] bg-denim px-4 py-3 text-sm font-bold text-white shadow-nav-btn transition hover:-translate-y-0.5 hover:shadow-lg"
            href={cta.href}
          >
            {cta.label}
          </a>
        )
      ) : (
        <div className="min-w-[148px]" aria-hidden="true" />
      )}
    </nav>
  )
}
