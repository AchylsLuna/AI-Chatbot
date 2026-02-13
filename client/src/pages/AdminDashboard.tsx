import { useEffect, useState } from 'react'
import type { AccessRequest, AuthSession } from '../types/triage'
import { formatRoleLabel } from '../utils/roles'
import { api } from '../services/api'

type AdminDashboardProps = {
  authUser: AuthSession['user'] | null
}

type AdminDashboardTab = 'overview' | 'requirements'

const adminModules = [
  {
    title: 'User provisioning',
    description: 'Invite staff, issue credentials, and align access with department needs.',
  },
  {
    title: 'Policy enforcement',
    description: 'Set minimum security controls, MFA requirements, and data retention rules.',
  },
  {
    title: 'Audit readiness',
    description: 'Review immutable booking ledger events and export compliance snapshots.',
  },
  {
    title: 'System configuration',
    description: 'Manage departments, triage rules, and escalation routing paths.',
  },
]

const roleDefinitions = [
  {
    title: 'User',
    summary: 'Patients and staff with self-service access to their own bookings.',
    permissions: ['View personal appointments', 'Update profile and contact info', 'Receive status updates'],
  },
  {
    title: 'Nurse / Doctor',
    summary: 'Clinical staff who can review, validate, or override Decision Tree outcomes.',
    permissions: ['Review triage summaries', 'Approve or re-route bookings', 'Document clinical notes'],
  },
  {
    title: 'Admin',
    summary: 'Operational leads managing staffing, policy controls, and day-to-day access.',
    permissions: ['Assign roles to staff', 'Manage departments and schedules', 'Monitor KPIs'],
  },
  {
    title: 'System Admin',
    summary: 'Platform owners with infrastructure, security, and integration authority.',
    permissions: ['Configure SSO and security policies', 'Manage integrations and data exports', 'Approve escalations'],
  },
]

const governanceChecklist = [
  'Least-privilege role assignments with quarterly review cadence.',
  'Immutable ledger checks for every booked appointment.',
  'Separation of duties between clinical review and access provisioning.',
  'Incident response runbooks for security or data integrity alerts.',
]

const adminTabs: Array<{
  key: AdminDashboardTab
  label: string
  description: string
}> = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'Operational modules, role definitions, and active request queue.',
  },
  {
    key: 'requirements',
    label: 'Requirements',
    description: 'Required role checks, submission details, and approval flow.',
  },
]

const adminAccessRequirements = [
  'Role must be Admin or System Admin.',
  'Verified work account with organization ownership.',
  'MFA and session security controls enabled.',
  'All elevated actions are audit logged.',
]

const requiredSubmissionDetails = [
  'Full name and organization email address.',
  'Department, requested role, and scope of access.',
  'Reason for elevated access and expected duration.',
  'Approver notes and compliance references.',
]

const approvalFlowDetails = [
  'Requester submits required account and role details.',
  'System validates identity and minimum security requirements.',
  'Admin reviewer approves, rejects, or requests clarification.',
  'Final status and reviewer notes are written to audit records.',
]

const AdminDashboard = ({ authUser }: AdminDashboardProps) => {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [requestsError, setRequestsError] = useState<string | null>(null)
  const [isRequestsLoading, setIsRequestsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview')

  useEffect(() => {
    if (!authUser) return
    if (!['admin', 'system_admin'].includes(authUser.role)) return
    let isMounted = true
    const loadRequests = async () => {
      setIsRequestsLoading(true)
      setRequestsError(null)
      try {
        const requests = await api.getAccessRequests()
        if (isMounted) setAccessRequests(requests)
      } catch (error) {
        if (isMounted) {
          setRequestsError(error instanceof Error ? error.message : 'Unable to load requests')
        }
      } finally {
        if (isMounted) setIsRequestsLoading(false)
      }
    }

    loadRequests()
    return () => {
      isMounted = false
    }
  }, [authUser])

  return (
    <div className="page-shell">
      <div className="page-wrap">
        <div className="page-header" data-reveal>
          <div>
            <p className="page-eyebrow">Administrative control layer</p>
            <h1 className="page-title">Admin dashboard</h1>
            <p className="page-copy">
              Manage roles, configure policies, and keep audit trails aligned with healthcare
              requirements.
            </p>
          </div>
          <div className="agent-chip">Governance console</div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-1" data-reveal>
          <div className="grid gap-1 sm:grid-cols-2">
            {adminTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="px-4 pb-3 pt-2 text-xs text-[color:var(--agent-muted)]">
            {adminTabs.find((tab) => tab.key === activeTab)?.description}
          </p>
        </div>

        {activeTab === 'overview' ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-3xl agent-card p-6" data-reveal>
                <h3 className="text-lg font-semibold text-white">Access requests</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                  Review pending access requests submitted through the signup form.
                </p>
                {isRequestsLoading ? (
                  <p className="mt-4 text-sm text-white/60">Loading access requests...</p>
                ) : requestsError ? (
                  <p className="mt-4 text-sm text-rose-300">{requestsError}</p>
                ) : accessRequests.length === 0 ? (
                  <p className="mt-4 text-sm text-white/60">No requests available.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {accessRequests.slice(0, 4).map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl agent-card-soft p-4 text-sm text-white/70"
                      >
                        <p className="font-semibold text-white">{request.fullName}</p>
                        <p className="text-xs text-white/60">{request.email}</p>
                        <p className="mt-2 text-xs text-white/60">
                          Requested role: {formatRoleLabel(request.roleRequested)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-3xl agent-card p-6" data-reveal>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Access status
                    </p>
                    <h2 className="text-lg font-semibold text-white">
                      {authUser ? `Signed in as ${authUser.username}` : 'Admin access required'}
                    </h2>
                    <p className="text-sm text-[color:var(--agent-muted)]">
                      {authUser
                        ? `Active role: ${formatRoleLabel(
                            authUser.role
                          )}. Administrative actions are logged.`
                        : 'Only Admin or System Admin can modify roles and policies.'}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-white/60">Security tier: RBAC</div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {adminModules.map((module) => (
                    <div key={module.title} className="rounded-2xl agent-card-soft p-4">
                      <p className="text-sm font-semibold text-white">{module.title}</p>
                      <p className="mt-2 text-xs text-white/60">{module.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl agent-card p-6" data-reveal>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Role definitions</h2>
                    <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                      Four-tier role model for patients, clinicians, and administrators.
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-white/60">4 roles</div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {roleDefinitions.map((role) => (
                    <div key={role.title} className="rounded-2xl agent-card-soft p-4">
                      <p className="text-sm font-semibold text-white">{role.title}</p>
                      <p className="mt-2 text-xs text-white/60">{role.summary}</p>
                      <ul className="mt-3 space-y-2 text-xs text-white/70">
                        {role.permissions.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl agent-card p-6" data-reveal>
                <h3 className="text-lg font-semibold text-white">Governance checklist</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                  Admin dashboard details for security, audit, and compliance workflows.
                </p>
                <ul className="mt-4 space-y-3 text-sm text-white/70">
                  {governanceChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl agent-card p-6" data-reveal>
                <h3 className="text-lg font-semibold text-white">Admin dashboard details</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                  Use this space to communicate how access is granted, which policies are enforced,
                  and where approvals are recorded.
                </p>
                <div className="mt-4 space-y-3 text-sm text-white/70">
                  <p>Role changes are logged automatically with timestamps and reviewer notes.</p>
                  <p>Clinical overrides require Nurse/Doctor review before Admin approval.</p>
                  <p>System Admins manage integrations, backup policies, and incident responses.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl agent-card p-6" data-reveal>
              <h3 className="text-lg font-semibold text-white">Admin dashboard requirements</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Minimum requirements before granting access to the Admin dashboard.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {adminAccessRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl agent-card p-6" data-reveal>
              <h3 className="text-lg font-semibold text-white">Required submission details</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Information required when requesting Admin or System Admin access.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {requiredSubmissionDetails.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl agent-card p-6 lg:col-span-2" data-reveal>
              <h3 className="text-lg font-semibold text-white">Approval flow details</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Standard review sequence used for elevated access in this project.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {approvalFlowDetails.map((step) => (
                  <div key={step} className="rounded-2xl agent-card-soft p-4 text-sm text-white/70">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
