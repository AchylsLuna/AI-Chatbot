import { useState } from 'react'

type DoctorAccess = {
  drChen: boolean
  drRodriguez: boolean
  drWatson: boolean
  drPark: boolean
}

const providers = [
  { key: 'drChen', name: 'Dr. Sarah Chen', specialty: 'Cardiology' },
  { key: 'drRodriguez', name: 'Dr. Michael Rodriguez', specialty: 'Orthopedics' },
  { key: 'drWatson', name: 'Dr. Emily Watson', specialty: 'Neurology' },
  { key: 'drPark', name: 'Dr. James Park', specialty: 'General practice' },
] as const

const vitals = [
  { label: 'Blood pressure', value: '118 / 76' },
  { label: 'Heart rate', value: '72 bpm' },
  { label: 'SpO2', value: '98%' },
  { label: 'BMI', value: '23.1' },
]

const PatientProfile = () => {
  const [doctorAccess, setDoctorAccess] = useState<DoctorAccess>({
    drChen: true,
    drRodriguez: true,
    drWatson: false,
    drPark: true,
  })

  const toggleAccess = (doctor: keyof DoctorAccess) => {
    setDoctorAccess((prev) => ({ ...prev, [doctor]: !prev[doctor] }))
  }

  return (
    <div className="page-shell">
      <div className="page-wrap">
        <div className="page-header" data-reveal>
          <div>
            <p className="page-eyebrow">Patient intelligence layer</p>
            <h1 className="page-title">Patient digital twin</h1>
            <p className="page-copy">
              Unified profile, contextual health history, and permission controls for secure care
              collaboration.
            </p>
          </div>
          <div className="agent-chip">Blockchain secured</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr_1fr]">
          <section className="rounded-3xl agent-card p-6" data-reveal>
            <div className="mb-6 border-b border-white/10 pb-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)]">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  <path d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="mt-3 text-lg font-semibold text-white">Sarah Johnson</p>
              <p className="text-xs text-white/60">Patient ID: P-2847</p>
            </div>

            <div className="space-y-4 text-sm text-[color:var(--agent-muted)]">
              <div className="rounded-2xl agent-card-soft p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Profile</p>
                <p className="mt-2 font-semibold text-white">March 15, 1985 · San Francisco, CA</p>
                <p className="mt-1 text-xs text-white/60">sarah.j@email.com · +1 (555) 123-4567</p>
              </div>

              <div className="rounded-2xl agent-card-soft p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Clinical summary</p>
                <ul className="mt-2 space-y-2 text-xs text-white/70">
                  <li>Stable vitals with no critical alerts.</li>
                  <li>Post-surgical recovery completed successfully.</li>
                  <li>Cardiovascular screening due in 3 months.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-3xl agent-card p-6" data-reveal>
            <h2 className="text-lg font-semibold text-white">Interactive body map</h2>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Clickable regions can be connected to imaging and encounter records.
            </p>

            <div className="mt-6 flex min-h-[360px] items-center justify-center rounded-2xl agent-card-soft p-4">
              <svg viewBox="0 0 200 300" className="w-full max-w-xs text-[color:var(--agent-accent)]">
                <circle cx="100" cy="40" r="25" fill="currentColor" opacity="0.85" />
                <rect x="75" y="65" width="50" height="80" rx="10" fill="currentColor" opacity="0.85" />
                <circle cx="50" cy="90" r="15" fill="currentColor" opacity="0.75" />
                <circle cx="150" cy="90" r="15" fill="currentColor" opacity="0.75" />
                <circle cx="30" cy="120" r="12" fill="currentColor" opacity="0.7" />
                <circle cx="170" cy="120" r="12" fill="currentColor" opacity="0.7" />
                <circle cx="85" cy="180" r="15" fill="currentColor" opacity="0.78" />
                <circle cx="115" cy="180" r="15" fill="currentColor" opacity="0.78" />
                <circle cx="75" cy="230" r="14" fill="currentColor" opacity="0.72" />
                <circle cx="125" cy="230" r="14" fill="currentColor" opacity="0.72" />
                <g stroke="currentColor" strokeWidth="2" opacity="0.55" fill="none">
                  <line x1="50" y1="90" x2="75" y2="80" />
                  <line x1="150" y1="90" x2="125" y2="80" />
                  <line x1="30" y1="120" x2="50" y2="100" />
                  <line x1="170" y1="120" x2="150" y2="100" />
                  <line x1="85" y1="180" x2="85" y2="145" />
                  <line x1="115" y1="180" x2="115" y2="145" />
                  <line x1="75" y1="230" x2="85" y2="195" />
                  <line x1="125" y1="230" x2="115" y2="195" />
                </g>
              </svg>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {vitals.map((item) => (
                <div key={item.label} className="rounded-2xl agent-card-soft p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl agent-card p-6" data-reveal>
            <h2 className="text-lg font-semibold text-white">Record access controls</h2>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Permissions are represented as smart-contract style grants and revocations.
            </p>

            <div className="mt-5 space-y-3">
              {providers.map((provider) => (
                <div key={provider.key} className="rounded-2xl agent-card-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{provider.name}</p>
                      <p className="text-xs text-white/60">{provider.specialty}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAccess(provider.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        doctorAccess[provider.key] ? 'bg-[color:var(--agent-accent)]' : 'bg-white/20'
                      }`}
                      aria-label={`Toggle access for ${provider.name}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          doctorAccess[provider.key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/12 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                Immutable notice
              </p>
              <p className="mt-1 text-xs text-amber-100/90">
                Access grants are logged and auditable. Historical events cannot be rewritten.
              </p>
            </div>

            <div className="mt-5 rounded-2xl agent-card-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Recent access log
              </p>
              <div className="mt-3 space-y-2 text-xs text-white/70">
                <p>Dr. Sarah Chen viewed ECG results · 2h ago</p>
                <p>Dr. James Park updated medication notes · 5h ago</p>
                <p>Dr. Michael Rodriguez reviewed imaging · 1d ago</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PatientProfile
