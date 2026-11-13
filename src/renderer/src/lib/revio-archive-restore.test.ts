import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  restoreScenario,
  restoreScenarioText,
  restoredWorkspaceName,
  sameCommit
} from './revio-archive-restore'

const refCompare = vi.fn()
beforeEach(() => {
  refCompare.mockReset()
  vi.stubGlobal('window', { api: { git: { refCompare } } })
})

const record = { branch: 'dev/feature', archiveCommit: 'abc1234' }

describe('restoreScenario', () => {
  it('reports a branch another workspace holds without asking git', async () => {
    expect(await restoreScenario(record, '/repo', ['main', 'dev/feature'])).toBe('branchTaken')
    expect(refCompare).not.toHaveBeenCalled()
  })

  it('reports a deleted branch', async () => {
    refCompare.mockResolvedValue({ summary: { headOid: null } })
    expect(await restoreScenario(record, '/repo', [])).toBe('branchDeleted')
    expect(refCompare).toHaveBeenCalledWith({
      worktreePath: '/repo',
      baseRef: 'abc1234',
      headRef: 'refs/heads/dev/feature'
    })
  })

  it('reports a branch that moved past the archive commit', async () => {
    refCompare.mockResolvedValue({ summary: { headOid: 'def5678000' } })
    expect(await restoreScenario(record, '/repo', [])).toBe('branchDiverged')
  })

  it('reopens the branch when it is where it was archived, or when git cannot tell', async () => {
    refCompare.mockResolvedValue({ summary: { headOid: 'abc1234ffff' } })
    expect(await restoreScenario(record, '/repo', [])).toBeNull()
    refCompare.mockRejectedValue(new Error('no repo'))
    expect(await restoreScenario(record, '/repo', [])).toBeNull()
  })
})

describe('restore text and names', () => {
  it("uses the layout's wording", () => {
    expect(restoreScenarioText('branchDiverged', 'x')).toEqual({
      title: 'Restore to new branch?',
      body: 'This workspace was last on x, but someone updated that branch in the meantime. Restore to a new branch to preserve your work.'
    })
  })

  it('names the restored workspace after the branch', () => {
    expect(restoredWorkspaceName({ branch: 'dev/feature', displayName: 'F' })).toBe(
      'feature-restored'
    )
  })

  it('matches short and full commit ids', () => {
    expect(sameCommit('abc1234', 'abc1234ff')).toBe(true)
    expect(sameCommit('', 'abc')).toBe(false)
  })
})
