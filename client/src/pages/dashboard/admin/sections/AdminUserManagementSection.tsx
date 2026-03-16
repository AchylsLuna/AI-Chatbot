import { Fragment } from 'react'
import PaginationControls from '../../../../components/layout/PaginationControls'
import {
  pageFieldClass,
  pageGhostButtonClass,
  pagePrimaryButtonClass,
} from '../../../../styles/pageUi'
import type { Reservation } from '../../../../types'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'

export type AdminUserManagementTab = 'users' | 'doctors'

export type AdminUserManagementItem = {
  key: string
  displayName: string
  referenceId: string
  bookingCount: number
  latestActivity: string
  latestStatus: Reservation['status'] | 'None'
  accountStatus: 'Active' | 'Disabled'
  contactEmail: string
  note: string
}

type AdminUserManagementSectionProps = {
  activeTab: AdminUserManagementTab
  onTabChange: (tab: AdminUserManagementTab) => void
  itemsByTab: Record<AdminUserManagementTab, AdminUserManagementItem[]>
  pagedItems: AdminUserManagementItem[]
  currentPage: number
  onPageChange: (page: number) => void
  pageSize: number
  maxPageButtons: number
  dataMaskingEnabled: boolean
  editingKey: string | null
  draftName: string
  draftEmail: string
  draftNote: string
  onDraftNameChange: (value: string) => void
  onDraftEmailChange: (value: string) => void
  onDraftNoteChange: (value: string) => void
  onBeginEdit: (item: AdminUserManagementItem) => void
  onSaveEdit: (key: string) => void
  onCancelEdit: () => void
  onSetAccountStatus: (key: string, status: 'Active' | 'Disabled') => void
  actionMessage: string | null
  actionError: string | null
}

const accountStatusBadgeClass = (status: AdminUserManagementItem['accountStatus']) => {
  if (status === 'Disabled') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
}

const AdminUserManagementSection = ({
  activeTab,
  onTabChange,
  itemsByTab,
  pagedItems,
  currentPage,
  onPageChange,
  pageSize,
  maxPageButtons,
  dataMaskingEnabled,
  editingKey,
  draftName,
  draftEmail,
  draftNote,
  onDraftNameChange,
  onDraftEmailChange,
  onDraftNoteChange,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  onSetAccountStatus,
  actionMessage,
  actionError,
}: AdminUserManagementSectionProps) => {
  const tabLabelMap: Record<AdminUserManagementTab, string> = {
    users: 'Users',
    doctors: 'Doctors',
  }

  const tabDescriptionMap: Record<AdminUserManagementTab, string> = {
    users: 'Patient account profiles derived from reservation activity.',
    doctors: 'Doctor roster derived from appointment assignments.',
  }

  const activeItems = itemsByTab[activeTab]

  return (
    <section className="space-y-3">
      <article className="reference-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="reference-section-title">User management</h2>
            <p className="reference-widget-subtle mt-1">{tabDescriptionMap[activeTab]}</p>
          </div>
          <p className="text-xs font-semibold text-[color:var(--agent-muted-soft)]">
            Showing {activeItems.length} records in {tabLabelMap[activeTab]}.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(['users', 'doctors'] as const).map((tab) => {
            const isActive = tab === activeTab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                    : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:text-[color:var(--agent-ink)]'
                }`}
              >
                {tabLabelMap[tab]} ({itemsByTab[tab].length})
              </button>
            )
          })}
        </div>
      </article>

      {actionMessage ? (
        <article className="reference-card p-4">
          <p className="text-sm font-semibold text-emerald-600">{actionMessage}</p>
        </article>
      ) : null}

      {actionError ? (
        <article className="reference-card p-4">
          <p className="text-sm font-semibold text-rose-600">{actionError}</p>
        </article>
      ) : null}

      {activeItems.length === 0 ? (
        <article className="reference-card p-5">
          <h2 className="reference-section-title">No records available</h2>
          <p className="reference-widget-subtle mt-2">Records will appear here once appointment data is available.</p>
        </article>
      ) : (
        <article className="reference-card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Contact
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Bookings
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Account
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[color:var(--card-border)]">
                {pagedItems.map((item) => {
                  const displayName = dataMaskingEnabled ? maskPersonName(item.displayName) : item.displayName
                  const displayRef = dataMaskingEnabled ? maskIdentifier(item.referenceId) : item.referenceId
                  const isEditing = editingKey === item.key

                  return (
                    <Fragment key={item.key}>
                      <tr>
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-[color:var(--agent-ink)]">{displayName}</p>
                          <p className="text-xs text-[color:var(--agent-muted)]">{displayRef}</p>
                        </td>
                        <td className="px-3 py-3 text-[color:var(--agent-muted)]">
                          {item.contactEmail || 'No contact email'}
                        </td>
                        <td className="px-3 py-3 font-semibold text-[color:var(--agent-ink)]">{item.bookingCount}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${accountStatusBadgeClass(item.accountStatus)}`}>
                            {item.accountStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={pageGhostButtonClass} onClick={() => onBeginEdit(item)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className={pageGhostButtonClass}
                              disabled={item.accountStatus === 'Active'}
                              onClick={() => onSetAccountStatus(item.key, 'Active')}
                            >
                              Active
                            </button>
                            <button
                              type="button"
                              className={pageGhostButtonClass}
                              disabled={item.accountStatus === 'Disabled'}
                              onClick={() => onSetAccountStatus(item.key, 'Disabled')}
                            >
                              Disable
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEditing ? (
                        <tr>
                          <td colSpan={5} className="px-3 pb-3">
                            <div className="reference-card-soft p-3">
                              <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Edit record</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                <input
                                  value={draftName}
                                  onChange={(event) => onDraftNameChange(event.target.value)}
                                  className={pageFieldClass}
                                  placeholder="Display name"
                                />
                                <input
                                  value={draftEmail}
                                  onChange={(event) => onDraftEmailChange(event.target.value)}
                                  className={pageFieldClass}
                                  placeholder="Contact email"
                                />
                                <input
                                  value={draftNote}
                                  onChange={(event) => onDraftNoteChange(event.target.value)}
                                  className={pageFieldClass}
                                  placeholder="Internal note"
                                />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={pagePrimaryButtonClass}
                                  onClick={() => onSaveEdit(item.key)}
                                >
                                  Save
                                </button>
                                <button type="button" className={pageGhostButtonClass} onClick={onCancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalItems={activeItems.length}
        pageSize={pageSize}
        maxPageButtons={maxPageButtons}
        onPageChange={onPageChange}
      />
    </section>
  )
}

export default AdminUserManagementSection
