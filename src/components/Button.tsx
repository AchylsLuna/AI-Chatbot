import type { ReactNode } from 'react'

type ButtonProps = {
  children: ReactNode
  href?: string
}

export function PrimaryButton({ children, href = '#' }: ButtonProps) {
  return (
    <a
      className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-transparent bg-denim px-5 py-3 text-[15px] font-bold text-white shadow-nav-btn transition duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      href={href}
    >
      {children}
    </a>
  )
}

export function GhostButton({ children, href = '#' }: ButtonProps) {
  return (
    <a
      className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-denim/30 bg-white px-5 py-3 text-[15px] font-bold text-slate transition duration-150 hover:-translate-y-0.5 hover:bg-[#f5f8fd]"
      href={href}
    >
      {children}
    </a>
  )
}
