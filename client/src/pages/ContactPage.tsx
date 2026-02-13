import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'

const revealDelay = (ms: number): CSSProperties =>
  ({ '--reveal-delay': `${ms}ms` } as CSSProperties)

const teamMembers = [
  { name: 'Dr. Sarah Mitchell', role: 'Chief Medical Officer' },
  { name: 'James Chen', role: 'Lead AI Architect' },
  { name: 'Maria Rodriguez', role: 'Blockchain Engineer' },
  { name: 'David Park', role: 'Product Manager' },
  { name: 'Emily Watson', role: 'UX Research Lead' },
]

const contactChannels = [
  { label: 'Support', value: 'support@pulseledger.health' },
  { label: 'Clinical partnerships', value: 'partners@pulseledger.health' },
  { label: 'Response time', value: 'Within 1 business day' },
]

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })

  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="page-shell">
      <div className="page-wrap">
        <div className="page-header" data-reveal>
          <div>
            <p className="page-eyebrow">Contact and support</p>
            <h1 className="page-title">Talk to the AI Health Care team</h1>
            <p className="page-copy">
              Share product feedback, report a workflow issue, or ask about clinical onboarding.
            </p>
          </div>
          <div className="agent-chip">Human support</div>
        </div>

        <div className="mb-8 rounded-3xl agent-card-soft p-5" data-reveal style={revealDelay(60)}>
          <p className="text-sm text-[color:var(--agent-muted)]">
            This is a UI sandbox for intake and triage operations. Messages in this page stay in
            the local client for now.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl agent-card p-6" data-reveal style={revealDelay(100)}>
            <h2 className="text-lg font-semibold text-white">Get in touch</h2>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Include your role, deployment context, and the page where the issue occurs.
            </p>

            {submitted && (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/12 p-4 text-sm font-semibold text-emerald-200">
                Message received. The team will follow up by email.
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="contact-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                  Full name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="agent-input mt-2"
                  placeholder="Jordan Lee"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                  Work email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="agent-input mt-2"
                  placeholder="you@hospital.org"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, message: event.target.value }))
                  }
                  className="agent-textarea mt-2 min-h-[140px] resize-none"
                  placeholder="Share context, expected behavior, and what happened instead."
                  required
                />
              </div>

              <button type="submit" className="agent-button w-full">
                Send message
              </button>
            </form>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl agent-card p-6" data-reveal style={revealDelay(140)}>
              <h2 className="text-lg font-semibold text-white">Contact channels</h2>
              <div className="mt-4 space-y-3">
                {contactChannels.map((item) => (
                  <div key={item.label} className="rounded-2xl agent-card-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl agent-card p-6" data-reveal style={revealDelay(180)}>
              <h2 className="text-lg font-semibold text-white">Core team</h2>
              <div className="mt-4 space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.name} className="rounded-2xl agent-card-soft p-4">
                    <p className="text-sm font-semibold text-white">{member.name}</p>
                    <p className="mt-1 text-xs text-white/60">{member.role}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactPage
