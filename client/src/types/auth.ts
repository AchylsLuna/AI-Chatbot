export type UserRole = 'user' | 'nurse' | 'admin' | 'system_admin'
export type AuthProvider = 'local' | 'auth0'

export type AuthSession = {
  token: string
  user: {
    username: string
    role: UserRole
    authMethod?: string
    mfa?: boolean
    sessionId?: string | null
  }
}

export type LoginOtpChallenge = {
  challengeId: string
  username: string
  expiresAt: string
  expiresInSeconds: number
  otpPreview?: string
}

export type SignupDraft = {
  username: string
  password: string
  fullName?: string
  email?: string
  organization?: string
}

export type AccessRequest = {
  id: string
  fullName: string
  email: string
  organization: string
  roleRequested: UserRole
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  notes?: string
  reviewedAt?: string
}
