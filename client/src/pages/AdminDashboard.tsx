import { useEffect, useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar'
import {
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePanelSoftClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import type { AccessRequest, AuthSession } from '../types/triage'
import { formatRoleLabel } from '../utils/roles'
import { api } from '../services/api'

type AdminDashboardProps = {
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
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
    title: 'Nurse',
    summary: 'Clinical staff supporting intake flow, triage follow-up, and appointment updates.',
    permissions: ['Review triage summaries', 'Approve or re-route bookings', 'Document clinical notes'],
  },
  {
    title: 'Admin / Doctor',
    summary: 'Operational doctors managing appointments, staffing, and day-to-day clinical operations.',
    permissions: ['Assign roles to staff', 'Manage departments and schedules', 'Monitor KPIs'],
  },
  {
    title: 'Super Admin',
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
  icon: 'home' | 'settings'
}> = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'Operational modules, role definitions, and active request queue.',
    icon: 'home',
  },
  {
    key: 'requirements',
    label: 'Requirements',
    description: 'Required role checks, submission details, and approval flow.',
    icon: 'settings',
  },
]

const adminAccessRequirements = [
  'Role must be Admin or Super Admin.',
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

const panelClass = workspacePanelClass
const panelSoftClass = workspacePanelSoftClass
const headingTextClass = workspaceHeadingTextClass
const mutedTextClass = workspaceMutedTextClass
const subtleTextClass = workspaceSubtleTextClass

const AdminDashboard = ({ authUser, onNavigate }: AdminDashboardProps) => {
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

  const requestMetrics = useMemo(() => {
    const pending = accessRequests.filter((item) => item.status === 'pending').length
    const approved = accessRequests.filter((item) => item.status === 'approved').length
    const rejected = accessRequests.filter((item) => item.status === 'rejected').length
    return { total: accessRequests.length, pending, approved, rejected }
  }, [accessRequests])

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className={`${panelClass} relative overflow-hidden p-6 sm:p-7`}>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(71,212,200,0.2),transparent_68%)] lg:block" />
          <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>
                Administrative control layer
              </p>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
                Admin dashboard
              </h1>
              <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>
                Manage roles, configure policies, and keep audit trails aligned with healthcare
                requirements.
              </p>
              <div className="mt-4 rounded-full border border-[rgba(71,212,200,0.45)] bg-[rgba(71,212,200,0.12)] px-3 py-1 text-xs font-semibold text-[#b6fff1] inline-flex">
                Governance console
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Requests', value: requestMetrics.total },
                { label: 'Pending', value: requestMetrics.pending },
                { label: 'Approved', value: requestMetrics.approved },
                { label: 'Rejected', value: requestMetrics.rejected },
              ].map((card) => (
                <div key={card.label} className={`${panelSoftClass} p-4`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>{card.label}</p>
                  <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[16.25rem_minmax(0,1fr)]">
          <WorkspaceSidebar
            className="h-fit p-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
            brandTitle="Healix AI"
            brandSubtitle="Admin workspace"
            onBrandClick={() => onNavigate?.('landing')}
            sectionLabel="Admin navigation"
            items={adminTabs}
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key as AdminDashboardTab)}
            statusLabel="Governance"
            statusValue="Policy controls active"
            profileLabel="Signed in"
            profileValue={authUser?.username ?? 'Unknown'}
            profileCaption={formatRoleLabel(authUser?.role)}
          />

          <section className="space-y-6">
            {activeTab === 'overview' ? (
              <>
                <div className={`${panelClass} p-6`}>
                  <h3 className={`text-xl font-semibold ${headingTextClass}`}>Access requests</h3>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>
                    Review pending access requests submitted through the signup form.
                  </p>
                  {isRequestsLoading ? (
                    <p className={`mt-4 text-sm ${mutedTextClass}`}>Loading access requests...</p>
                  ) : requestsError ? (
                    <p className="mt-4 text-sm text-rose-300">{requestsError}</p>
                  ) : accessRequests.length === 0 ? (
                    <p className={`mt-4 text-sm ${mutedTextClass}`}>No requests available.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {accessRequests.slice(0, 5).map((request) => (
                        <div key={request.id} className={`${panelSoftClass} p-4 text-sm ${mutedTextClass}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className={`font-semibold ${headingTextClass}`}>{request.fullName}</p>
                              <p className={`text-xs ${mutedTextClass}`}>{request.email}</p>
                            </div>
                            <span className="rounded-full border border-[rgba(120,139,198,0.34)] bg-[rgba(16,23,42,0.6)] px-3 py-1 text-xs font-semibold text-[#d9e5ff]">
                              {request.status}
                            </span>
                          </div>
                          <p className={`mt-2 text-xs ${subtleTextClass}`}>
                            Requested role: {formatRoleLabel(request.roleRequested)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className={`${panelClass} p-6`}>
                    <h2 className={`text-xl font-semibold ${headingTextClass}`}>Role definitions</h2>
                    <p className={`mt-2 text-sm ${mutedTextClass}`}>
                      Four-tier role model for patients, clinicians, and administrators.
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {roleDefinitions.map((role) => (
                        <div key={role.title} className={`${panelSoftClass} p-4`}>
                          <p className={`text-sm font-semibold ${headingTextClass}`}>{role.title}</p>
                          <p className={`mt-2 text-xs ${mutedTextClass}`}>{role.summary}</p>
                          <ul className={`mt-3 space-y-2 text-xs ${mutedTextClass}`}>
                            {role.permissions.map((permission) => (
                              <li key={permission}>{permission}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className={`${panelClass} p-6`}>
                      <h3 className={`text-lg font-semibold ${headingTextClass}`}>Governance checklist</h3>
                      <p className={`mt-2 text-sm ${mutedTextClass}`}>
                        Security, audit, and compliance workflows for admin operations.
                      </p>
                      <ul className={`mt-4 space-y-3 text-sm ${mutedTextClass}`}>
                        {governanceChecklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={`${panelClass} p-6`}>
                      <h3 className={`text-lg font-semibold ${headingTextClass}`}>Module controls</h3>
                      <div className="mt-4 space-y-3">
                        {adminModules.map((module) => (
                          <article key={module.title} className={`${panelSoftClass} p-4`}>
                            <p className={`text-sm font-semibold ${headingTextClass}`}>{module.title}</p>
                            <p className={`mt-1 text-xs ${mutedTextClass}`}>{module.description}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={`${panelClass} p-6`}>
                  <h3 className={`text-lg font-semibold ${headingTextClass}`}>Admin dashboard requirements</h3>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>
                    Minimum requirements before granting access to the Admin dashboard.
                  </p>
                  <ul className={`mt-4 space-y-3 text-sm ${mutedTextClass}`}>
                    {adminAccessRequirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className={`${panelClass} p-6`}>
                  <h3 className={`text-lg font-semibold ${headingTextClass}`}>Required submission details</h3>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>
                    Information required when requesting Admin or Super Admin access.
                  </p>
                  <ul className={`mt-4 space-y-3 text-sm ${mutedTextClass}`}>
                    {requiredSubmissionDetails.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className={`${panelClass} p-6 lg:col-span-2`}>
                  <h3 className={`text-lg font-semibold ${headingTextClass}`}>Approval flow details</h3>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>
                    Standard review sequence used for elevated access in this project.
                  </p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {approvalFlowDetails.map((step) => (
                      <div key={step} className={`${panelSoftClass} p-4 text-sm ${mutedTextClass}`}>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default AdminDashboard
