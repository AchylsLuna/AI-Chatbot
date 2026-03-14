import type { Reservation } from '../../../../types'
import {
  formatPhilippineMonthYear,
  formatPhilippineTime,
  getPhilippineDateParts,
} from '../../../../utils/dateTime'
import { maskPersonName } from '../../../../utils/privacy'

type DoctorCalendarSectionProps = {
  reservations: Reservation[]
  dataMaskingEnabled: boolean
}

type CalendarCell = {
  day: number
  appointments: Reservation[]
} | null

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toTimestamp = (value: string) => {
  const parsed = new Date(value)
  const timestamp = parsed.getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

const DoctorCalendarSection = ({ reservations, dataMaskingEnabled }: DoctorCalendarSectionProps) => {
  const todayInPhilippines = getPhilippineDateParts(new Date())
  const year = todayInPhilippines?.year ?? new Date().getUTCFullYear()
  const month = (todayInPhilippines?.month ?? 1) - 1
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const startWeekday = firstDayOfMonth.getUTCDay()

  const appointmentsByDay = new Map<number, Reservation[]>()

  for (const reservation of reservations) {
    const parts = getPhilippineDateParts(reservation.requestedTime)
    if (!parts) continue
    if (parts.year !== year || parts.month !== month + 1) continue

    const day = parts.day
    const bucket = appointmentsByDay.get(day) ?? []
    bucket.push(reservation)
    appointmentsByDay.set(day, bucket)
  }

  for (const [day, bucket] of appointmentsByDay) {
    bucket.sort((a, b) => {
      const aTime = toTimestamp(a.requestedTime) ?? 0
      const bTime = toTimestamp(b.requestedTime) ?? 0
      return aTime - bTime
    })
    appointmentsByDay.set(day, bucket)
  }

  const cells: CalendarCell[] = []

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, appointments: appointmentsByDay.get(day) ?? [] })
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const monthLabel = formatPhilippineMonthYear(firstDayOfMonth)

  const appointmentsThisMonth = Array.from(appointmentsByDay.values()).reduce(
    (total, bucket) => total + bucket.length,
    0
  )

  return (
    <section className="space-y-3">
      <article className="reference-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="reference-section-title">Monthly appointment calendar</h2>
            <p className="reference-widget-subtle mt-1">
              {monthLabel} view with all scheduled appointments grouped by day.
            </p>
          </div>
          <p className="text-xs font-semibold text-[color:var(--agent-muted-soft)]">
            {appointmentsThisMonth} appointment{appointmentsThisMonth === 1 ? '' : 's'} this month
          </p>
        </div>
      </article>

      <article className="reference-card overflow-x-auto p-4">
        <table className="min-w-[760px] w-full border-collapse">
          <thead>
            <tr>
              {weekdayLabels.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="border border-[color:var(--agent-border)] bg-[color:var(--agent-surface-muted)] px-3 py-2 text-left text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, rowIndex) => (
              <tr key={`week-${rowIndex}`}>
                {cells.slice(rowIndex * 7, rowIndex * 7 + 7).map((cell, columnIndex) => (
                  <td
                    key={`cell-${rowIndex}-${columnIndex}`}
                    className="h-32 align-top border border-[color:var(--agent-border)] p-2"
                  >
                    {cell ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[color:var(--agent-ink)]">{cell.day}</p>
                        {cell.appointments.length > 0 ? (
                          <div className="space-y-2">
                            {cell.appointments.slice(0, 3).map((reservation) => (
                              <div
                                key={reservation.id}
                                className="rounded-md border border-[color:var(--agent-border)] bg-[color:var(--agent-surface-muted)] px-2 py-1"
                              >
                                <p className="text-[11px] font-semibold text-[color:var(--agent-ink)]">
                                  {formatPhilippineTime(reservation.requestedTime)}
                                </p>
                                <p className="text-[11px] text-[color:var(--agent-muted)]">
                                  {dataMaskingEnabled
                                    ? maskPersonName(reservation.patientName)
                                    : reservation.patientName}
                                </p>
                              </div>
                            ))}
                            {cell.appointments.length > 3 ? (
                              <p className="text-[11px] font-semibold text-[color:var(--agent-muted-soft)]">
                                +{cell.appointments.length - 3} more
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[color:var(--agent-muted-soft)]">No appointments</p>
                        )}
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}

export default DoctorCalendarSection
