import type { AppPage } from '../types/navigation'
import type { AuthProvider, AuthSession } from '../types'

const AUTH_PROVIDER = String(import.meta.env.VITE_AUTH_PROVIDER || 'local').toLowerCase()
const isAuth0Requested = AUTH_PROVIDER === 'auth0'

export const getAuthProvider = (): AuthProvider => 'local'

export const isAuth0Enabled = (): boolean => false

export const isBiometricHookAvailable = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
  if (!window.isSecureContext) return false
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export const hasAuth0RedirectParams = () => {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.has('code') && params.has('state')
}

export const startAuth0Login = async (targetPage?: AppPage) => {
  void targetPage
  if (isAuth0Requested) {
    throw new Error('Auth0 package is not available in this frontend-only build.')
  }
  throw new Error('Auth0 is disabled. Use local sign in.')
}

export const handleAuth0Redirect = async (): Promise<AppPage | null> => {
  return null
}

export const getAuth0Session = async (): Promise<AuthSession | null> => {
  return null
}

export const logoutAuth0Session = async () => {
  return
}
