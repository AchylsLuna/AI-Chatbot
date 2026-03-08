import PaginationControls from '../../../../components/layout/PaginationControls'
import { workspaceFieldClass, workspaceGhostButtonClass } from '../../../../styles/workspaceUi'
import type { Reservation } from '../../../../types'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'

type ReservationFilterStatus = 'all' | Reservation['status']

type AdminAppointmentsSectionProps = {
  pagedReservations: Reservation[]
  filteredReservations: Reservation[]
  searchableReservationCount: number
  statusFilter: ReservationFilterStatus
  onStatusFilterChange: (next: ReservationFilterStatus) => void
  onResetFilters: () => void
  dataMaskingEnabled: boolean
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

const formatDateTime = (value: string) => {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

const AdminAppointmentsSection = ({
  pagedReservations,
  filteredReservations,
  searchableReservationCount,
  statusFilter,
  onStatusFilterChange,
  onResetFilters,
  dataMaskingEnabled,
  currentPage,
  onPageChange,
  pageSize,
  maxPageButtons,
}: AdminAppointmentsSectionProps) => {
  const bookedCount = filteredReservations.filter((item) => item.status === 'Booked').length
  const recordedCount = filteredReservations.filter((item) => item.status === 'Recorded').length
  const failedCount = filteredReservations.filter((item) => item.status === 'Failed').length

  return (
    <section className="space-y-3">
      <article className="reference-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="reference-section-title">Appointment workspace</h2>
            <p className="reference-widget-subtle mt-1">
              Review appointment queue status and monitor latest booking activity.
            </p>
          </div>
          <p className="text-xs font-semibold text-[color:var(--agent-muted-soft)]">
            Showing {filteredReservations.length} of {searchableReservationCount} appointments.
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="reference-card-soft p-3">
            <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">Visible</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--agent-ink)]">{filteredReservations.length}</p>
          </div>
          <div className="reference-card-soft p-3">
            <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">Booked</p>
            <p className="mt-1 text-xl font-semibold text-sky-600">{bookedCount}</p>
          </div>
          <div className="reference-card-soft p-3">
            <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">Recorded</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">{recordedCount}</p>
          </div>
          <div className="reference-card-soft p-3">
            <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">Failed</p>
            <p className="mt-1 text-xl font-semibold text-rose-600">{failedCount}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_160px_1fr] md:items-center">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as ReservationFilterStatus)}
            className={workspaceFieldClass}
          >
            <option value="all">All statuses</option>
            <option value="Booked">Booked</option>
            <option value="Recorded">Recorded</option>
            <option value="Failed">Failed</option>
          </select>

          <button type="button" className={workspaceGhostButtonClass} onClick={onResetFilters}>
            Reset filters
          </button>

          <p className="text-xs text-[color:var(--agent-muted-soft)]">
            Use the search field above to match by patient, id, department, or summary.
          </p>
        </div>
      </article>

      {filteredReservations.length === 0 ? (
        <article className="reference-card p-5">
          <h2 className="reference-section-title">No appointments found</h2>
          <p className="reference-widget-subtle mt-2">
            Adjust your search query or status filter to view matching records.
          </p>
        </article>
      ) : (
        pagedReservations.map((reservation) => (
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
                  {reservation.department} · {reservation.requestedTime}
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
                <p>Nurse: {reservation.nurseName ?? 'Unassigned'}</p>
                <p>Logged {formatDateTime(reservation.createdAt)}</p>
              </div>
            </div>
          </article>
        ))
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

export default AdminAppointmentsSection
