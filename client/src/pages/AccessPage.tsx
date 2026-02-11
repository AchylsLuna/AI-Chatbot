import { useEffect } from 'react'
import type { AppPage } from '../types/navigation'

type AccessPageProps = {
  onNavigate?: (page: AppPage) => void
}

const AccessPage = ({ onNavigate }: AccessPageProps) => {
  useEffect(() => {
    onNavigate?.('login')
  }, [onNavigate])

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 text-sm text-white/70 shadow-2xl shadow-black/40">
          Redirecting to login...
        </div>
      </div>
    </div>
  )
}

export default AccessPage
