import type { Auth0Client, RedirectLoginOptions, User } from '@auth0/auth0-spa-js'
import type { AppPage } from '../types/navigation'
import type { AuthProvider, AuthSession, UserRole } from '../types/triage'

const AUTH_PROVIDER = String(import.meta.env.VITE_AUTH_PROVIDER || 'local').toLowerCase()
const AUTH0_DOMAIN = String(import.meta.env.VITE_AUTH0_DOMAIN || '').trim()
const AUTH0_CLIENT_ID = String(import.meta.env.VITE_AUTH0_CLIENT_ID || '').trim()
const AUTH0_AUDIENCE = String(import.meta.env.VITE_AUTH0_AUDIENCE || '').trim()
const AUTH0_SCOPE =
  String(import.meta.env.VITE_AUTH0_SCOPE || '').trim() || 'openid profile email offline_access'
const AUTH0_ROLE_CLAIM =
  String(import.meta.env.VITE_AUTH0_ROLE_CLAIM || 'https://healix.app/role').trim()

const isAuth0Mode = AUTH_PROVIDER === 'auth0'
const hasAuth0Config = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID)
const canUseAuth0 = isAuth0Mode && hasAuth0Config

let auth0ClientPromise: Promise<Auth0Client | null> | null = null

const resolveAllowedRole = (value: unknown): UserRole => {
  if (typeof value === 'string') {
    if (value === 'user' || value === 'nurse' || value === 'admin' || value === 'system_admin') {
      return value
    }
  }
  return 'user'
}

const resolveUserRole = (claims: Record<string, unknown>): UserRole => {
  const roleClaim = claims[AUTH0_ROLE_CLAIM]
  if (Array.isArray(roleClaim)) {
    for (const entry of roleClaim) {
      const role = resolveAllowedRole(entry)
      if (role !== 'user') return role
    }
  }
  return resolveAllowedRole(roleClaim)
}

const resolveMfa = (claims: Record<string, unknown>) => {
  const amr = Array.isArray(claims.amr) ? claims.amr : []
  const hasStrongFactor = amr.some((method) =>
    typeof method === 'string' ? ['mfa', 'fpt', 'face', 'otp', 'webauthn'].includes(method) : false
  )
  if (hasStrongFactor) return true
  const acr = typeof claims.acr === 'string' ? claims.acr.toLowerCase() : ''
  return acr.includes('mfa') || acr.includes('phrh')
}

const toSessionUser = (
  profile: User | undefined,
  claims: Record<string, unknown>
): AuthSession['user'] => {
  const username =
    typeof profile?.email === 'string' && profile.email
      ? profile.email
      : typeof profile?.name === 'string' && profile.name
        ? profile.name
        : typeof profile?.sub === 'string'
          ? profile.sub
          : 'auth0-user'

  return {
    username: username.toLowerCase(),
    role: resolveUserRole(claims),
    authMethod: 'auth0',
    mfa: resolveMfa(claims),
    sessionId: typeof profile?.sub === 'string' ? profile.sub : null,
  }
}

const getAuth0Client = async (): Promise<Auth0Client | null> => {
  if (!canUseAuth0) return null
  if (!auth0ClientPromise) {
    auth0ClientPromise = import('@auth0/auth0-spa-js').then(({ createAuth0Client }) =>
      createAuth0Client({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        authorizationParams: {
          audience: AUTH0_AUDIENCE || undefined,
          scope: AUTH0_SCOPE,
        },
        cacheLocation: 'memory',
        useRefreshTokens: true,
      })
    )
  }
  return auth0ClientPromise
}

export const getAuthProvider = (): AuthProvider => (canUseAuth0 ? 'auth0' : 'local')

export const isAuth0Enabled = (): boolean => canUseAuth0

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
  const client = await getAuth0Client()
  if (!client) throw new Error('Auth0 is not configured.')

  const options: RedirectLoginOptions = {
    appState: {
      targetPage: targetPage || null,
    },
    authorizationParams: {
      prompt: 'login',
      audience: AUTH0_AUDIENCE || undefined,
      scope: AUTH0_SCOPE,
    },
  }
  await client.loginWithRedirect(options)
}

export const handleAuth0Redirect = async (): Promise<AppPage | null> => {
  const client = await getAuth0Client()
  if (!client) return null
  if (!hasAuth0RedirectParams()) return null

  const callback = await client.handleRedirectCallback()
  return typeof callback.appState?.targetPage === 'string'
    ? (callback.appState.targetPage as AppPage)
    : null
}

export const getAuth0Session = async (): Promise<AuthSession | null> => {
  const client = await getAuth0Client()
  if (!client) return null
  const isAuthenticated = await client.isAuthenticated()
  if (!isAuthenticated) return null

  const token = await client.getTokenSilently().catch(() => null)
  if (!token) return null
  const profile = await client.getUser()
  const claims = (await client.getIdTokenClaims()) || {}

  return {
    token,
    user: toSessionUser(profile, claims as Record<string, unknown>),
  }
}

export const logoutAuth0Session = async () => {
  const client = await getAuth0Client()
  if (!client) return
  if (typeof window === 'undefined') return
  await client.logout({
    logoutParams: {
      returnTo: window.location.origin,
    },
  })
}

