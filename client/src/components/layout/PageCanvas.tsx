import type { CSSProperties, ReactNode } from 'react'

type PageCanvasProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

const PageCanvas = ({ children, className = '', style }: PageCanvasProps) => (
  <div
    className={`relative min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)] ${className}`}
    style={style}
  >
    <div className="relative z-10">{children}</div>
  </div>
)

export default PageCanvas
