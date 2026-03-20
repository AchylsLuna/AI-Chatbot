import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredPostLoginTarget,
  readStoredPostLoginTarget,
  writeStoredPostLoginTarget,
} from './postLoginTarget'

describe('postLoginTarget storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('writes and reads a stored post-login target', () => {
    writeStoredPostLoginTarget({
      page: 'doctor_dashboard',
      authPage: 'doctor_login',
      path: '/doctor/calendar',
    })

    expect(readStoredPostLoginTarget()).toEqual({
      page: 'doctor_dashboard',
      authPage: 'doctor_login',
      path: '/doctor/calendar',
      updatedAt: expect.any(Number),
    })
  })

  it('clears invalid or expired entries', () => {
    window.sessionStorage.setItem(
      'pulse-post-login-target',
      JSON.stringify({
        page: 'doctor_dashboard',
        authPage: 'doctor_login',
        path: '/doctor/calendar',
        updatedAt: Date.now() - 31 * 60 * 1000,
      })
    )

    expect(readStoredPostLoginTarget()).toBeNull()
    expect(window.sessionStorage.getItem('pulse-post-login-target')).toBeNull()
  })

  it('removes the stored target explicitly', () => {
    writeStoredPostLoginTarget({
      page: 'appointments',
      authPage: 'login',
      path: '/History',
    })

    clearStoredPostLoginTarget()
    expect(readStoredPostLoginTarget()).toBeNull()
  })
})
