import { describe, expect, it } from 'vitest'
import { resolveCanonicalPath, resolvePageFromPath } from './routing'
import { resolveTabCanonicalPath } from './roleTabRoutes'

describe('routing canonicalization', () => {
  it('canonicalizes patient legacy aliases to patient routes', () => {
    expect(resolvePageFromPath('/appointments/history')).toBe('appointments')
    expect(resolveCanonicalPath('/appointments/history')).toBe('/History')
    expect(resolveTabCanonicalPath('/worker')).toBe('/BookAppointment')
  })

  it('canonicalizes doctor and admin legacy aliases', () => {
    expect(resolvePageFromPath('/dashboard/doctor')).toBe('doctor_dashboard')
    expect(resolveCanonicalPath('/dashboard/doctor')).toBe('/doctor/dashboard')
    expect(resolveCanonicalPath('/admin/history')).toBe('/admin/audit-log')
  })

  it('keeps canonical routes stable', () => {
    expect(resolveCanonicalPath('/doctor/calendar')).toBe('/doctor/calendar')
    expect(resolveCanonicalPath('/admin/error-log')).toBe('/admin/error-log')
    expect(resolveCanonicalPath('/BookAppointment')).toBe('/BookAppointment')
  })
})
