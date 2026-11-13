import { afterEach, describe, expect, it, vi } from 'vitest'

const forkUrl = vi.hoisted((): { value: string | null } => ({ value: null }))
vi.mock('../../shared/fork-services', () => ({
  forkServiceUrl: (name: string) => (name === 'diagnosticsUploadUrl' ? forkUrl.value : null)
}))

const { resolveDiagnosticTokenEndpoint } = await import('./diagnostic-upload-endpoint')

afterEach(() => {
  forkUrl.value = null
  delete process.env.ORCA_DIAGNOSTICS_TOKEN_URL
  Reflect.deleteProperty(globalThis, 'ORCA_DIAGNOSTICS_TOKEN_URL')
})

describe('resolveDiagnosticTokenEndpoint', () => {
  it('stays off without a fork-identity endpoint, whatever env or build defines say', () => {
    process.env.ORCA_DIAGNOSTICS_TOKEN_URL = 'https://elsewhere.example/token'
    Object.assign(globalThis, { ORCA_DIAGNOSTICS_TOKEN_URL: 'https://built.example/token' })
    expect(resolveDiagnosticTokenEndpoint()).toBeNull()
  })

  it('uses the fork endpoint when one is set', () => {
    forkUrl.value = 'https://diagnostics.example/token'
    expect(resolveDiagnosticTokenEndpoint()).toBe('https://diagnostics.example/token')
  })
})
