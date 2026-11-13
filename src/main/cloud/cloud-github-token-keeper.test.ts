import { describe, expect, it, vi } from 'vitest'

vi.mock('@vercel/sandbox', () => ({}))
vi.mock('./cloud-network-apply', () => ({
  applyNetworkToRunningWorkspaces: vi.fn(),
  repoIdsWithRunningWorkspaces: vi.fn(() => [])
}))

import { startGithubTokenKeeper, type TokenKeeperDeps } from './cloud-github-token-keeper'

function harness(running: string[]): {
  deps: TokenKeeperDeps
  fire: (event: string) => void
  wake: () => void
  tick: () => void
  applied: string[]
  ensureFresh: ReturnType<typeof vi.fn>
} {
  let listener: (event: string) => void = () => undefined
  let onWake: () => void = () => undefined
  let onTick: () => void = () => undefined
  const applied: string[] = []
  const ensureFresh = vi.fn(async () => 'token')
  const repos = [
    { id: 'a', path: '/a' },
    { id: 'b', path: '/b' }
  ]
  const deps: TokenKeeperDeps = {
    getRepos: () => repos,
    runningRepoIds: () => running,
    apply: async (repoId) => {
      applied.push(repoId)
      return 1
    },
    ensureFresh,
    subscribe: (next) => {
      listener = next
      return () => undefined
    },
    onWake: (next) => {
      onWake = next
      return () => undefined
    },
    setInterval: (next) => {
      onTick = next
      return () => undefined
    }
  }
  return {
    deps,
    fire: (event) => listener(event),
    wake: () => onWake(),
    tick: () => onTick(),
    applied,
    ensureFresh
  }
}

describe('GitHub token keeper', () => {
  it('pushes a rotated token into every running workspace’s repository', async () => {
    const h = harness(['b'])
    startGithubTokenKeeper(h.deps)
    h.fire('rotated')
    await vi.waitFor(() => expect(h.applied).toEqual(['b']))
  })

  it('pushes the new token after a sign-in, and closes GitHub when the sign-in expires', async () => {
    const h = harness(['a', 'b'])
    startGithubTokenKeeper(h.deps)
    h.fire('expired')
    await vi.waitFor(() => expect(h.applied).toEqual(['a', 'b']))
    h.fire('signed-in')
    await vi.waitFor(() => expect(h.applied).toEqual(['a', 'b', 'a', 'b']))
  })

  it('refreshes ahead of expiry only while a cloud workspace runs', () => {
    const idle = harness([])
    startGithubTokenKeeper(idle.deps)
    idle.tick()
    expect(idle.ensureFresh).not.toHaveBeenCalled()
    const busy = harness(['a'])
    startGithubTokenKeeper(busy.deps)
    busy.tick()
    busy.wake()
    expect(busy.ensureFresh).toHaveBeenCalledTimes(2)
  })
})
