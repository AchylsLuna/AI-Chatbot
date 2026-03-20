import { z } from 'zod'
import { sanitizeOptionalText, sanitizeText } from '../utils/sanitize'

const safeTextSchema = z
  .string()
  .transform((value) => sanitizeText(value))
  .refine((value) => value.length > 0, 'Expected non-empty text')

const safeOptionalTextSchema = z
  .string()
  .optional()
  .transform((value) => sanitizeOptionalText(value))

const userRoleSchema = z.enum(['user', 'doctor', 'admin', 'system_admin'])
const reservationStatusSchema = z.enum(['Booked', 'Recorded', 'Failed'])
const triagePrioritySchema = z.enum(['Low', 'Routine', 'High'])
const triageSummaryProofSchema = z.object({
  version: z.literal('v1'),
  issuedAt: z.coerce.number().int().nonnegative(),
  expiresAt: z.coerce.number().int().positive(),
  nonce: safeTextSchema,
  signature: safeTextSchema,
})

export const authUserSchema = z.object({
  username: safeTextSchema,
  firstName: safeOptionalTextSchema,
  lastName: safeOptionalTextSchema,
  role: userRoleSchema,
  accountType: safeOptionalTextSchema.nullable().optional(),
  authMethod: safeOptionalTextSchema,
  mfa: z.boolean().optional(),
  sessionId: safeOptionalTextSchema.nullable().optional(),
})

export const authSessionSchema = z.object({
  token: safeOptionalTextSchema,
  csrfToken: safeOptionalTextSchema,
  user: authUserSchema,
})

export const loginOtpChallengeSchema = z.object({
  challengeId: safeTextSchema,
  username: safeTextSchema,
  expiresAt: safeTextSchema,
  expiresInSeconds: z.coerce.number().int().positive(),
  otpPreview: safeOptionalTextSchema,
})

export const triageSummarySchema = z.object({
  department: safeTextSchema,
  priority: triagePrioritySchema,
  confidence: z.coerce.number().finite().min(0).max(1),
  summary: safeTextSchema,
  symptoms: safeTextSchema,
  disclaimer: safeTextSchema,
  source: z.enum(['ai', 'rules', 'decision_tree']).optional(),
  proof: triageSummaryProofSchema.optional(),
})

export const reservationSchema = z.object({
  id: safeTextSchema,
  patientName: safeTextSchema,
  symptoms: safeTextSchema,
  department: safeTextSchema,
  priority: triagePrioritySchema,
  confidence: z.coerce.number().finite().min(0).max(1),
  requestedTime: safeTextSchema,
  createdAt: safeTextSchema,
  status: reservationStatusSchema,
  summary: safeTextSchema,
})

export const ledgerEntrySchema = z.object({
  id: safeTextSchema,
  reservationId: safeTextSchema,
  patientName: safeTextSchema,
  department: safeTextSchema,
  timestamp: safeTextSchema,
  hash: safeTextSchema,
  txHash: safeOptionalTextSchema,
  txStatus: z.enum(['confirmed', 'failed', 'skipped']).optional(),
  chainId: safeOptionalTextSchema,
})

export const accessRequestSchema = z.object({
  id: safeTextSchema,
  fullName: safeTextSchema,
  email: safeTextSchema,
  organization: safeTextSchema,
  roleRequested: userRoleSchema,
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: safeTextSchema,
  notes: safeOptionalTextSchema,
  reviewedAt: safeOptionalTextSchema,
})

export const reservationsResponseSchema = z.object({
  reservations: z.array(reservationSchema),
})

export const appointmentsResponseSchema = z.object({
  appointments: z.array(reservationSchema),
})

export const ledgerResponseSchema = z.object({
  ledger: z.array(ledgerEntrySchema),
})

export const createdReservationResponseSchema = z.object({
  reservation: reservationSchema,
  ledgerEntry: ledgerEntrySchema,
})

export const appointmentResponseSchema = z.object({
  appointment: reservationSchema,
})

export const accessRequestsResponseSchema = z.object({
  requests: z.array(accessRequestSchema),
})

export const supportTicketReceiptResponseSchema = z.object({
  message: safeOptionalTextSchema,
  ticket: z.object({
    id: safeTextSchema,
    status: z.enum(['open', 'closed']),
    createdAt: safeTextSchema,
  }),
})

export const aiAlertAuditResponseSchema = z.object({
  ok: z.boolean(),
})

export const parseApiSchema = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown,
  context: string
): z.output<TSchema> => {
  const parsed = schema.safeParse(payload)
  if (parsed.success) return parsed.data

  const firstIssue = parsed.error.issues[0]
  const path = firstIssue?.path?.length ? firstIssue.path.join('.') : 'root'
  const detail = firstIssue?.message || 'Unknown schema violation'
  throw new Error(`Invalid ${context} response (${path}): ${detail}`)
}
