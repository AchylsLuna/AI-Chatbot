export type LedgerEntry = {
  id: string
  reservationId: string
  patientName: string
  department: string
  timestamp: string
  hash: string
  txHash?: string
  txStatus?: 'confirmed' | 'failed' | 'skipped'
  chainId?: string
}

export type AlertAuditAction =
  | 'view'
  | 'dismiss'
  | 'approve'
  | 'open'
  | 'identity_reveal'
  | 'identity_hide'
