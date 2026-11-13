import type { Repo } from '../../shared/repo-types'
import { subscribeSystemPowerLifecycle } from '../power/system-power-lifecycle'
import { bestEffort } from './cloud-log'
import {
  applyNetworkToRunningWorkspaces,
  repoIdsWithRunningWorkspaces
} from './cloud-network-apply'
import { githubAccessToken, onGithubSessionChange } from './github-app-session'

/**
 * Keeps running sandboxes on a live GitHub token. The broker holds a copy of the access token in
 * each sandbox's network policy, and GitHub's app tokens die after 8 hours, so: refresh ahead of
 * expiry while any cloud workspace runs, and push every rotation (or sign-in, sign-out, expiry)
 * into the running sandboxes' policies at once. Resumed sandboxes get a fresh policy on resume anyway.
 * A Mac asleep past the expiry cannot do this; the first tick after wake catches up.
 */
const TICK_MS = 5 * 60_000

export type TokenKeeperDeps = {
  getRepos: () => readonly { id: string; path: string }[]
  runningRepoIds: () => string[]
  apply: (repoId: string, repoPath: string) => Promise<number>
  ensureFresh: () => Promise<unknown>
  subscribe: (listener: (event: string) => void) => () => void
  onWake: (listener: () => void) => () => void
  setInterval: (callback: () => void, ms: number) => () => void
}

export async function pushGithubTokenToRunningWorkspaces(
  deps: Pick<TokenKeeperDeps, 'getRepos' | 'runningRepoIds' | 'apply'>
): Promise<number> {
  const running = new Set(deps.runningRepoIds())
  let applied = 0
  for (const repo of deps.getRepos()) {
    if (running.has(repo.id)) {
      applied += await deps.apply(repo.id, repo.path).catch(() => 0)
    }
  }
  return applied
}

export function startGithubTokenKeeper(deps: TokenKeeperDeps): () => void {
  const tick = (): void => {
    if (deps.runningRepoIds().length === 0) {
      return
    }
    // Refreshes only inside the margin before expiry; a rotation then pushes through `subscribe`.
    void deps.ensureFresh().catch(bestEffort('Refreshing the GitHub sign-in for cloud workspaces'))
  }
  const offSession = deps.subscribe(() => {
    void pushGithubTokenToRunningWorkspaces(deps).catch(
      bestEffort('Updating running cloud workspaces with the new GitHub token')
    )
  })
  const offWake = deps.onWake(tick)
  const offInterval = deps.setInterval(tick, TICK_MS)
  return () => {
    offSession()
    offWake()
    offInterval()
  }
}

export function startDefaultGithubTokenKeeper(getRepos: () => Repo[]): () => void {
  return startGithubTokenKeeper({
    getRepos,
    runningRepoIds: repoIdsWithRunningWorkspaces,
    apply: applyNetworkToRunningWorkspaces,
    ensureFresh: () => githubAccessToken(),
    subscribe: onGithubSessionChange,
    onWake: (listener) =>
      subscribeSystemPowerLifecycle({ onSuspend: () => undefined, onResume: listener }),
    setInterval: (callback, ms) => {
      const timer = setInterval(callback, ms)
      timer.unref?.()
      return () => clearInterval(timer)
    }
  })
}
