import type { CSSProperties, ReactNode } from 'react'

type WorkspaceCanvasProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

const WorkspaceCanvas = ({ children, className = '', style }: WorkspaceCanvasProps) => (
  <div
    className={`relative min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)] ${className}`}
    style={style}
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.02),transparent_220px)]" />
    <div className="relative z-10">{children}</div>
  </div>
)

export default WorkspaceCanvas
