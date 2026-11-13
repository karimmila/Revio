import { describe, expect, it, vi } from 'vitest'

const { ghExecFileAsyncMock } = vi.hoisted(() => ({ ghExecFileAsyncMock: vi.fn() }))

vi.mock('../git/command-runner/gh-exec-file', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ghExecFileAsync: ghExecFileAsyncMock
}))

import { clearGhCapabilityStateForTests, getGhMultiAccountCapability } from './gh-capability-state'

describe('gh-capability-state', () => {
  it('reports per-project binding unsupported without running gh auth token', async () => {
    clearGhCapabilityStateForTests()
    await expect(getGhMultiAccountCapability({ wslDistro: 'Ubuntu' })).resolves.toBe('unsupported')
    await expect(getGhMultiAccountCapability()).resolves.toBe('unsupported')
    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })
})
