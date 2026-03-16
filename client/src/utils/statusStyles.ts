import type { Reservation } from '../types'

export const neutralStatusChipClass = 'agent-status-chip agent-status-chip--neutral'
export const infoStatusChipClass = 'agent-status-chip agent-status-chip--info'
export const successStatusChipClass = 'agent-status-chip agent-status-chip--success'
export const warningStatusChipClass = 'agent-status-chip agent-status-chip--warning'
export const dangerStatusChipClass = 'agent-status-chip agent-status-chip--danger'

export const reservationStatusChipClass = (status: Reservation['status'] | 'None') => {
  if (status === 'Recorded') return successStatusChipClass
  if (status === 'Failed') return dangerStatusChipClass
  if (status === 'Booked') return infoStatusChipClass
  return neutralStatusChipClass
}
