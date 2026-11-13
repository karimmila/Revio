import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PRRefreshOutcome } from '../../shared/github/pull-request-refresh-types'

const { coordinatorMocks, moduleMocks } = await vi.hoisted(async () => {
  const moduleMocks = await import('./pr-refresh-coordinator-test-mocks')
  return { coordinatorMocks: moduleMocks.createPRRefreshCoordinatorMocks(), moduleMocks }
})
vi.mock('electron', () => moduleMocks.electronModuleMock(coordinatorMocks))
vi.mock('./client', () => moduleMocks.clientModuleMock(coordinatorMocks))
vi.mock('./github-api-repository', () =>
  moduleMocks.githubApiRepositoryModuleMock(coordinatorMocks)
)
vi.mock('./rate-limit', () => moduleMocks.rateLimitModuleMock(coordinatorMocks))
vi.mock('../ipc/ui', () => moduleMocks.ipcUiModuleMock(coordinatorMocks))

import { makeCandidate, makePR } from './pr-refresh-coordinator-test-harness'
import { PR_POLL_AWAY_RECHECK_MS } from './pr-poll-attention'

const { getPRForBranchOutcomeMock } = coordinatorMocks

function found(): PRRefreshOutcome {
  return {
    kind: 'found',
    pr: makePR({ state: 'open', checksStatus: 'success' }),
    // ast-grep-ignore: test-no-wall-clock -- the coordinator ages results against its own Date.now(), so a fixed stamp would read as stale
    fetchedAt: Date.now()
  }
}

describe('visible PR refreshes while nobody is at the Mac', () => {
  let attention: 'focused' | 'unfocused' | 'away' = 'focused'

  beforeEach(async () => {
    moduleMocks.resetPRRefreshCoordinatorMocks(coordinatorMocks)
    getPRForBranchOutcomeMock.mockImplementation(async () => found())
    attention = 'focused'
    // The mock reset reloads the module graph; set the reader on the instance the drainer sees.
    const { setPrPollAttentionSource } = await import('./pr-poll-attention')
    setPrPollAttentionSource(() => attention)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('makes no GitHub call while away and resumes once someone is back', async () => {
    attention = 'away'
    const { reportVisiblePRRefreshCandidates } = await import('./pr-refresh-coordinator')
    reportVisiblePRRefreshCandidates([makeCandidate()], 1, 1)
    await vi.advanceTimersByTimeAsync(10 * PR_POLL_AWAY_RECHECK_MS)
    expect(getPRForBranchOutcomeMock).not.toHaveBeenCalled()

    attention = 'focused'
    await vi.advanceTimersByTimeAsync(PR_POLL_AWAY_RECHECK_MS)
    expect(getPRForBranchOutcomeMock).toHaveBeenCalledTimes(1)
  })
})
