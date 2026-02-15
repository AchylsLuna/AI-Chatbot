import type { CSSProperties, ReactNode } from 'react'

type WorkspaceCanvasProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

const WorkspaceCanvas = ({ children, className = '', style }: WorkspaceCanvasProps) => (
  <div
    className={`relative min-h-screen overflow-x-hidden bg-[#060a16] pb-20 text-[#eaf0ff] ${className}`}
    style={style}
  >
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 left-[10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.22),transparent_70%)] blur-3xl" />
      <div className="absolute top-[18%] right-[7%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.2),transparent_68%)] blur-3xl" />
      <div className="absolute bottom-[-140px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(30,64,175,0.28),transparent_74%)] blur-3xl" />
    </div>

    <div className="relative z-10">{children}</div>
  </div>
)

export default WorkspaceCanvas
