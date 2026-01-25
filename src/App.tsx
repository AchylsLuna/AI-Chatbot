import { GhostButton, PrimaryButton } from './components/Button'
import { LogoMark } from './components/LogoMark'
import { NavBar } from './components/NavBar'

const navLinks = [
  { label: 'Home', href: '#' },
  { label: 'Features', href: '#' },
  { label: 'About', href: '#' },
  { label: 'Contact', href: '#' },
]

function App() {
  return (
    <div className="relative min-h-screen bg-hero-gradient text-slate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 30% 12%, rgba(27, 106, 213, 0.12), transparent 44%), radial-gradient(circle at 80% 18%, rgba(27, 106, 213, 0.08), transparent 42%)',
        }}
      />

      <header className="relative z-10 w-full">
        <div className="mx-auto w-full max-w-5xl px-6">
          <NavBar
            brand={<LogoMark />}
            links={navLinks}
            cta={{ label: 'Launch Platform', href: '#' }}
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-28 pt-12 text-center lg:pb-32 lg:pt-16">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.24em] text-blue-900/80">
          Next-generation healthcare platform
        </p>
        <h1 className="mb-5 text-4xl font-extrabold leading-tight text-navy sm:text-[46px] lg:text-[52px]">
          Your AI-Powered
          <br />
          Healthcare Intelligence
          <br />
          Platform
        </h1>
        <p className="mb-8 max-w-3xl text-lg leading-8 text-slate/90 lg:mb-10">
          Combining AI diagnostics, blockchain verification, and patient digital twin functionality for medical
          professionals. Make informed decisions with real-time analytics and secure, transparent health data.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PrimaryButton href="#">Launch Dashboard {'>'}</PrimaryButton>
          <GhostButton href="#">Learn More {'>'}</GhostButton>
        </div>
      </main>
    </div>
  )
}

export default App
