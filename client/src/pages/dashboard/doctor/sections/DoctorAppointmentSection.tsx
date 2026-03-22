import PaginationControls from '../../../../components/layout/PaginationControls'
import {
  pageFieldClass,
  pageGhostButtonClass,
  pagePrimaryButtonClass,
} from '../../../../styles/pageUi'
import type { Reservation } from '../../../../types'
import { formatPhilippineDateTime } from '../../../../utils/dateTime'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'

type AppointmentPane = 'Booked' | 'Recorded'

type DoctorAppointmentSectionProps = {
  pagedReservations: Reservation[]
  filteredReservations: Reservation[]
  searchableReservations: Reservation[]
  appointmentPane: AppointmentPane
  onAppointmentPaneChange: (next: AppointmentPane) => void
  onResetFilters: () => void
  dataMaskingEnabled: boolean
  editingId: string | null
  draftStatus: Reservation['status']
  draftTime: string
  draftDepartment: string
  onDraftStatusChange: (next: Reservation['status']) => void
  onDraftTimeChange: (next: string) => void
  onDraftDepartmentChange: (next: string) => void
  onBeginEdit: (reservation: Reservation) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  isSaving: boolean
  saveMessage: string | null
  saveError: string | null
  currentPage: number
  onPageChange: (page: number) => void
  pageSize: number
  maxPageButtons: number
}

const statusBadgeClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'bg-emerald-100 text-emerald-700 border-emerald-300/70'
  if (status === 'Failed') return 'bg-rose-100 text-rose-700 border-rose-300/70'
  return 'bg-sky-100 text-sky-700 border-sky-300/70'
}

const DoctorAppointmentSection = ({
  pagedReservations,
  filteredReservations,
  searchableReservations,
  appointmentPane,
  onAppointmentPaneChange,
  onResetFilters,
  dataMaskingEnabled,
  editingId,
  draftStatus,
  draftTime,
  draftDepartment,
  onDraftStatusChange,
  onDraftTimeChange,
  onDraftDepartmentChange,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  saveMessage,
  saveError,
  currentPage,
  onPageChange,
  pageSize,
  maxPageButtons,
}: DoctorAppointmentSectionProps) => {
  const bookedCount = searchableReservations.filter((item) => item.status === 'Booked').length
  const recordedCount = searchableReservations.filter((item) => item.status === 'Recorded').length

  return (
    <section className="space-y-3">
      <article className="reference-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="reference-section-title">Appointment command center</h2>
            <p className="reference-widget-subtle mt-1">
              Review queue status, filter records quickly, and update appointments inline.
            </p>
          </div>
          <p className="text-xs font-semibold text-[color:var(--agent-muted-soft)]">
            Showing {filteredReservations.length} {appointmentPane.toLowerCase()} appointments.
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onAppointmentPaneChange('Booked')}
            className={`${appointmentPane === 'Booked' ? pagePrimaryButtonClass : pageGhostButtonClass} w-full justify-between`}
          >
            <span>Booked appointments</span>
            <span>{bookedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => onAppointmentPaneChange('Recorded')}
            className={`${appointmentPane === 'Recorded' ? pagePrimaryButtonClass : pageGhostButtonClass} w-full justify-between`}
          >
            <span>Recorded appointments</span>
            <span>{recordedCount}</span>
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr] md:items-center">
          <button type="button" className={pageGhostButtonClass} onClick={onResetFilters}>
            Clear search
          </button>

          <p className="text-xs text-[color:var(--agent-muted-soft)]">
            Use the search field above to match by patient, id, department, or summary within this section.
          </p>
        </div>

        {saveMessage ? <p className="mt-3 text-sm font-semibold text-emerald-600">{saveMessage}</p> : null}
        {saveError ? <p className="mt-3 text-sm font-semibold text-rose-500">{saveError}</p> : null}
      </article>

      {filteredReservations.length === 0 ? (
        <article className="reference-card p-5">
          <h2 className="reference-section-title">No appointments found</h2>
          <p className="reference-widget-subtle mt-2">
            Adjust your search query or switch sections to view matching records.
          </p>
        </article>
      ) : (
        pagedReservations.map((reservation) => {
          const isEditing = editingId === reservation.id

          return (
            <article key={reservation.id} className="reference-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                    {dataMaskingEnabled ? maskIdentifier(reservation.id) : reservation.id}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">
                    {dataMaskingEnabled ? maskPersonName(reservation.patientName) : reservation.patientName}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                    {reservation.department} · {formatPhilippineDateTime(reservation.requestedTime)}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(reservation.status)}`}>
                  {reservation.status}
                </span>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <p className="text-sm text-[color:var(--agent-muted)]">{reservation.summary}</p>
                <div className="space-y-1 text-xs text-[color:var(--agent-muted-soft)] md:text-right">
                  <p>Doctor: {reservation.doctorName ?? 'Unassigned'}</p>
                  <p>Logged {formatPhilippineDateTime(reservation.createdAt)}</p>
                </div>
              </div>

              {isEditing ? (
                <div className="reference-card-soft mt-4 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Edit appointment
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <select
                      value={draftStatus}
                      onChange={(event) => onDraftStatusChange(event.target.value as Reservation['status'])}
                      className={pageFieldClass}
                    >
                      <option value="Booked">Booked</option>
                      <option value="Recorded">Recorded</option>
                      <option value="Failed">Failed</option>
                    </select>
                    <input
                      value={draftTime}
                      onChange={(event) => onDraftTimeChange(event.target.value)}
                      className={pageFieldClass}
                      placeholder="Requested time"
                    />
                    <input
                      value={draftDepartment}
                      onChange={(event) => onDraftDepartmentChange(event.target.value)}
                      className={pageFieldClass}
                      placeholder="Department"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onSaveEdit}
                      disabled={isSaving}
                      className={`${pagePrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isSaving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button type="button" onClick={onCancelEdit} className={pageGhostButtonClass}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <button type="button" onClick={() => onBeginEdit(reservation)} className={pageGhostButtonClass}>
                    Edit appointment
                  </button>
                </div>
              )}
            </article>
          )
        })
      )}

      <PaginationControls
        currentPage={currentPage}
        totalItems={filteredReservations.length}
        pageSize={pageSize}
        maxPageButtons={maxPageButtons}
        onPageChange={onPageChange}
      />
    </section>
  )
}

export default DoctorAppointmentSection
