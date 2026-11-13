import { describe, expect, it, vi } from 'vitest'

const { runProcessMock } = vi.hoisted(() => ({ runProcessMock: vi.fn() }))
vi.mock('@orca/process-host', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runProcess: runProcessMock
}))

import { loginGhWithToken } from './gh-token-login'

describe('loginGhWithToken', () => {
  it('is retired: it never hands a token to gh, whose keyring lives in the keychain', async () => {
    const result = await loginGhWithToken('ghp_secret')
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.error).not.toContain('ghp_secret')
    expect(runProcessMock).not.toHaveBeenCalled()
  })
})
