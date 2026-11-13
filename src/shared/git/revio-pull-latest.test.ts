import { describe, expect, it } from 'vitest'
import { decidePullLatest, pullLatestAgentPrompt, pullRebaseEnabled } from './revio-pull-latest'

const base = { base: 'origin/main', pullRebase: false }

describe('Pull latest', () => {
  it('fast-forwards only when the branch is just behind and clean', () => {
    expect(decidePullLatest({ ...base, ahead: 0, behind: 0, dirty: true })).toBe('up-to-date')
    expect(decidePullLatest({ ...base, ahead: 0, behind: 3, dirty: false })).toBe('fast-forwarded')
    expect(decidePullLatest({ ...base, ahead: 2, behind: 3, dirty: false })).toBe('diverged')
    expect(decidePullLatest({ ...base, ahead: 0, behind: 3, dirty: true })).toBe('uncommitted')
  })

  it('reads pull.rebase like git does', () => {
    expect(pullRebaseEnabled('true')).toBe(true)
    expect(pullRebaseEnabled('merges')).toBe(true)
    expect(pullRebaseEnabled('false')).toBe(false)
    expect(pullRebaseEnabled('')).toBe(false)
  })

  it('tells the agent to rebase or merge, committing first when dirty', () => {
    expect(pullLatestAgentPrompt({ base: 'origin/main', reason: 'diverged', rebase: true })).toBe(
      'Rebase this branch onto origin/main. Then push --force-with-lease.'
    )
    expect(
      pullLatestAgentPrompt({ base: 'origin/main', reason: 'uncommitted', rebase: false })
    ).toBe('Commit uncommitted changes, then merge origin/main into this branch. Then push.')
  })
})
