import type { CSSProperties } from 'react';

type LandingPageProps = {
  onNavigate?: (page: 'landing' | 'triage' | 'dashboard' | 'contact') => void;
};

const revealDelay = (index: number, base = 90): CSSProperties =>
  ({
    '--reveal-delay': `${index * base}ms`,
  } as CSSProperties);

const stats = [
  { label: 'Avg intake time', value: '2 min' },
  { label: 'Routing accuracy', value: '92%' },
  { label: 'Human confirmed', value: '100%' },
];

const features = [
  {
    title: 'Guided inquiry engine',
    description:
      'The AI assistant collects symptoms with guardrails and clarification prompts so patients do not self-diagnose.',
  },
  {
    title: 'Reservation first model',
    description:
      'Every booking is a reservation request until a nurse confirms the AI triage summary.',
  },
  {
    title: 'Realtime status tracking',
    description:
      'Users see status changes from Pending -> Approved/Declined with immediate updates.',
  },
];

const workflowSteps = [
  {
    title: 'Patient guided inquiry',
    description: 'Advice-only chat captures symptoms, duration, and urgency.',
  },
  {
    title: 'AI triage summary',
    description: 'NLP routes the case to the correct medical department.',
  },
  {
    title: 'Nurse or admin review',
    description: 'Human confirmation accepts or declines the reservation request.',
  },
  {
    title: 'Reservation status update',
    description: 'Patients receive Approved/Declined status and next steps.',
  },
];

const techStack = [
  {
    title: 'AI Platform',
    items: ['NLP triage engine', 'Advice-only guidance logic'],
  },
  {
    title: 'Web Platform',
    items: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express.js', 'REST API', 'MongoDB'],
  },
  {
    title: 'Blockchain Platform',
    items: ['Ethereum smart contracts', 'Immutable appointment ledger'],
  },
];

const architectureLayers = [
  {
    title: 'Presentation layer',
    description: 'React web UI for registration, chat, and status updates.',
  },
  {
    title: 'Application layer',
    description: 'Node.js and Express.js services coordinate user, AI, and blockchain data.',
  },
  {
    title: 'AI processing layer',
    description: 'NLP module maps symptoms to the correct department.',
  },
  {
    title: 'Blockchain layer (CODEX)',
    description: 'Ethereum smart contracts log accepted appointments and diagnoses.',
  },
  {
    title: 'Data layer',
    description: 'MongoDB stores non-sensitive profiles and reservation metadata.',
  },
];

const roadmap = [
  {
    title: 'Sprint 1: AI + core logic',
    badge: 'Foundation',
    items: [
      'NLP-driven chatbot for routing',
      'Reservation schema in MongoDB',
      'Nurse dashboard for manual review',
    ],
  },
  {
    title: 'Sprint 2: Blockchain + security',
    badge: 'Hardening',
    items: [
      'Smart contracts to log finalized appointments',
      'Cryptographic hashing for patient records',
      'Testing for accuracy and data immutability',
    ],
  },
];

const constraints = [
  {
    title: 'Advice only AI',
    description: 'Guidance follows doctor-approved rules and is not a diagnosis.',
  },
  {
    title: 'Security and RBAC',
    description: 'Passwords are salted and hashed; access follows least privilege.',
  },
  {
    title: 'Outpatient availability',
    description: 'Optimized for outpatient triage with stable realtime connections.',
  },
];

const LandingPage = ({ onNavigate }: LandingPageProps) => {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center" data-reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Pulse Ledger
            </div>
            <h1 className="text-4xl font-display font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              AI triage clarity.
              <span className="block text-[color:var(--agent-accent)]">Human approval always.</span>
            </h1>
            <p className="max-w-2xl text-lg text-[color:var(--agent-muted)]">
              Replace chaotic intake with a guided, auditable flow. Patients get answers fast, nurses
              get structured summaries, and every approval is tracked end-to-end.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[color:var(--agent-on-light)] shadow-lg transition hover:-translate-y-0.5"
                onClick={() => onNavigate?.('contact')}
              >
                Book a strategy call
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)] transition group-hover:translate-x-0.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </span>
              </button>
              <a
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40"
                href="#workflow"
              >
                View workflow
              </a>
            </div>
          </div>

          <div className="mx-auto mt-12 grid gap-4 sm:grid-cols-3">
            {stats.map((item, index) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center"
                data-reveal
                style={revealDelay(index)}
              >
                <p className="text-xs uppercase tracking-wider text-[color:var(--agent-muted)]">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div
            className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
            data-reveal
          >
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                System design and user flow
              </p>
              <h2 className="text-3xl font-display font-semibold text-white sm:text-4xl">
                Clear separation between AI triage and administrative confirmation
              </h2>
              <p className="text-[color:var(--agent-muted)]">
                The UI keeps the user informed while reserving final appointment decisions for
                clinical staff.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              <span className="rounded-full border border-white/10 px-4 py-2">React UI</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Guided inquiry</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Human approval</span>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6"
                data-reveal
                style={revealDelay(index)}
              >
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-[color:var(--agent-surface)]/40 py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4" data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Guided workflow
              </p>
              <h2 className="text-3xl font-display font-semibold text-white sm:text-4xl">
                Advice-only intake routed to the right department
              </h2>
              <p className="text-[color:var(--agent-muted)]">
                Patients receive support and clarity without skipping clinical review. Every
                decision is tracked and auditable.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                Status updates flow instantly to patients and staff. Pending -{'>'} Approved/Declined
                is visible at all times.
              </div>
            </div>

            <div
              className="relative rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8"
              data-reveal="slide-left"
            >
              <div className="absolute left-6 top-10 h-[calc(100%-80px)] w-px bg-white/10" />
              <div className="space-y-6">
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="relative pl-10"
                    data-reveal
                    style={revealDelay(index)}
                  >
                    <div className="absolute left-2 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4" data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Layered architecture
              </p>
              <h2 className="text-3xl font-display font-semibold text-white sm:text-4xl">
                Modular services for security, scale, and auditability
              </h2>
              <p className="text-[color:var(--agent-muted)]">
                Each layer isolates sensitive operations while keeping data flowing across the
                triage pipeline.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                Accepted appointments are written to the blockchain for tamper-proof records.
              </div>
            </div>

            <div className="space-y-4">
              {architectureLayers.map((layer, index) => (
                <div
                  key={layer.title}
                  className="flex items-start gap-4 rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-5"
                  data-reveal="slide-left"
                  style={revealDelay(index)}
                >
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      {layer.title}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{layer.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className="bg-[color:var(--agent-surface)]/40 py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div
            className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
            data-reveal
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Technology stack
              </p>
              <h2 className="text-3xl font-display font-semibold text-white sm:text-4xl">
                Tools chosen for speed, security, and delivery
              </h2>
              <p className="text-[color:var(--agent-muted)]">
                A pragmatic stack across AI, web, and blockchain services with REST APIs and
                MongoDB persistence.
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Production ready
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {techStack.map((stack, index) => (
              <div
                key={stack.title}
                className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6"
                data-reveal
                style={revealDelay(index)}
              >
                <h3 className="text-lg font-semibold text-white">{stack.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[color:var(--agent-muted)]">
                  {stack.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--agent-accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roadmap" className="bg-[color:var(--agent-surface)]/40 py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div
            className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
            data-reveal
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Development roadmap
              </p>
              <h2 className="text-3xl font-display font-semibold text-white sm:text-4xl">
                Two sprints to validate AI before blockchain hardening
              </h2>
              <p className="text-[color:var(--agent-muted)]">
                The roadmap keeps AI routing solid before adding immutable recordkeeping.
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Sprint delivery
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {roadmap.map((sprint, index) => (
              <div
                key={sprint.title}
                className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8"
                data-reveal
                style={revealDelay(index)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{sprint.title}</h3>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    {sprint.badge}
                  </span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-[color:var(--agent-muted)]">
                  {sprint.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="constraints" className="py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div
            className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
            data-reveal
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Technical constraints
              </p>
              <h2 className="text-3xl font-display font-semibold text-white sm:text-4xl">
                Guardrails keep the system safe and compliant
              </h2>
              <p className="text-[color:var(--agent-muted)]">
                The AI supports decision-making while nurses remain the final authority.
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Governance first
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {constraints.map((constraint, index) => (
              <div
                key={constraint.title}
                className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6"
                data-reveal
                style={revealDelay(index)}
              >
                <h3 className="text-lg font-semibold text-white">{constraint.title}</h3>
                <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
                  {constraint.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div
            className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent p-10"
            data-reveal
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  Ready for pilot
                </p>
                <h2 className="mt-3 text-3xl font-display font-semibold text-white sm:text-4xl">
                  Build triage flows patients can trust.
                </h2>
                <p className="mt-3 max-w-xl text-sm text-[color:var(--agent-muted)]">
                  Pair AI-guided intake with nurse confirmation, immutable records, and reservation
                  based booking.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <button
                  className="rounded-full bg-[color:var(--agent-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5"
                  onClick={() => onNavigate?.('dashboard')}
                >
                  Open nurse console
                </button>
                <a
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40"
                  href="#roadmap"
                >
                  View roadmap
                </a>
              </div>
            </div>
          </div>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
            <span>Pulse Ledger AI Triage Platform</span>
            <span>Advice-only guidance. Not a medical diagnosis.</span>
          </footer>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
