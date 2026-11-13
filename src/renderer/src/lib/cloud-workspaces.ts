import React from 'react'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID,
  parseExecutionHostId
} from '../../../shared/execution-host'
import { VERCEL_CLOUD_RECIPE_ID } from '../../../shared/cloud/cloud-recipe'
import type { Repo } from '../../../shared/repo-types'
import { FORK_HOME_FOLDER_NAME, LEGACY_HOME_FOLDER_NAME } from '../../../shared/fork-identity'

/**
 * Which Orca servers belong to cloud workspaces. A cloud workspace's repository lives on the
 * server its sandbox runs (`runtime:<environmentId>`), and the runtime record names the recipe,
 * so the set of those environments tells cloud repositories from local ones.
 */
let cloudEnvironmentIds: ReadonlySet<string> = new Set()
// The local repository each cloud environment's sandbox was created from.
let cloudSourceRepoIds: ReadonlyMap<string, string> = new Map()
// Until main has answered once, a cloud repository looks local; callers must not act on that.
let cloudEnvironmentIdsKnown = false
const listeners = new Set<() => void>()

export async function refreshCloudEnvironmentIds(): Promise<void> {
  const api = window.api.ephemeralVm
  if (!api?.listRuntimes) {
    return
  }
  try {
    const runtimes = await api.listRuntimes()
    const live = runtimes.filter(
      (runtime) =>
        runtime.recipeId === VERCEL_CLOUD_RECIPE_ID &&
        runtime.runtimeEnvironmentId !== undefined &&
        runtime.cleanupStatus !== 'succeeded'
    )
    const next = new Set(live.map((runtime) => runtime.runtimeEnvironmentId ?? ''))
    cloudSourceRepoIds = new Map(
      live.flatMap((runtime) =>
        runtime.runtimeEnvironmentId && runtime.repoId
          ? [[runtime.runtimeEnvironmentId, runtime.repoId] as const]
          : []
      )
    )
    const changed =
      !cloudEnvironmentIdsKnown ||
      next.size !== cloudEnvironmentIds.size ||
      [...next].some((environmentId) => !cloudEnvironmentIds.has(environmentId))
    cloudEnvironmentIdsKnown = true
    if (changed) {
      cloudEnvironmentIds = next
      for (const listener of listeners) {
        listener()
      }
    }
  } catch {
    // Keep the last known set; the next refresh retries.
  }
}

/** The local repository a cloud environment came from; null for any other environment. */
export function cloudSourceRepoIdNow(environmentId: string): string | null {
  return cloudSourceRepoIds.get(environmentId) ?? null
}

export function areCloudEnvironmentIdsKnown(): boolean {
  return cloudEnvironmentIdsKnown
}

export function cloudEnvironmentIdsNow(): ReadonlySet<string> {
  return cloudEnvironmentIds
}

export function useCloudEnvironmentIds(): ReadonlySet<string> {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => cloudEnvironmentIds,
    () => cloudEnvironmentIds
  )
}

export function isCloudRepo(
  repo: Pick<Repo, 'connectionId' | 'executionHostId'>,
  environmentIds: ReadonlySet<string>
): boolean {
  const host = parseExecutionHostId(getRepoExecutionHostId(repo))
  return host?.kind === 'runtime' && environmentIds.has(host.environmentId)
}

/**
 * The composer's recipe gate. The Cloud location creates through Orca's own cloud recipe
 * even with the VM experiment off; then only that recipe is offered, and it is preselected.
 */
export function cloudRecipeGate(
  settings: {
    revioLayout?: boolean
    revioLocation?: 'local' | 'cloud'
    experimentalEphemeralVms?: boolean
  } | null,
  initialRecipeId: string | undefined
): {
  enabled: boolean
  initialRecipeId: string | undefined
  visible: <T extends { id: string }>(recipes: T[]) => T[]
} {
  const cloud = settings?.revioLayout === true && settings.revioLocation === 'cloud'
  const experiment = settings?.experimentalEphemeralVms === true
  return {
    enabled: experiment || cloud,
    initialRecipeId: cloud ? VERCEL_CLOUD_RECIPE_ID : initialRecipeId,
    visible: (recipes) =>
      experiment ? recipes : recipes.filter((recipe) => recipe.id === VERCEL_CLOUD_RECIPE_ID)
  }
}

/** A project group creates folder workspaces on this Mac, so the Cloud location never offers one. */
export function cloudScopedProjectGroups<T>(
  settings: { revioLayout?: boolean; revioLocation?: 'local' | 'cloud' } | null,
  projectGroups: readonly T[]
): readonly T[] {
  return settings?.revioLayout === true && settings.revioLocation === 'cloud' ? [] : projectGroups
}

/** A cloud workspace's local mirror lives under the home cloud-mirrors folder (see main/cloud). */
export function isCloudMirrorPath(path: string | null | undefined): boolean {
  return [FORK_HOME_FOLDER_NAME, LEGACY_HOME_FOLDER_NAME].some((folder) =>
    path?.includes(`/${folder}/cloud-mirrors/`)
  )
}

/**
 * The workspace layout creates from the repository on this Mac in both locations: Mac workspaces
 * directly, cloud ones through the cloud recipe, which provisions from that local repository. A
 * repository also set up on a cloud sandbox must not become the default target.
 */
export function revioHostScope<T>(
  settings: { revioLayout?: boolean } | null,
  scope: T
): T | typeof LOCAL_EXECUTION_HOST_ID {
  return settings?.revioLayout === true ? LOCAL_EXECUTION_HOST_ID : scope
}

const ACTIVITY_REPORT_MS = 30_000

function busyCloudEnvironmentIds(state: {
  activeWorktreeId: string | null
  repos: readonly Repo[]
  agentStatusByPaneKey?: Record<string, { state: string; worktreeId?: string }>
}): string {
  const environmentOf = (worktreeId: string | null | undefined): string | null => {
    const repo = state.repos.find((candidate) => candidate.id === worktreeId?.split('::')[0])
    const host = repo ? parseExecutionHostId(getRepoExecutionHostId(repo)) : null
    return host?.kind === 'runtime' && cloudEnvironmentIds.has(host.environmentId)
      ? host.environmentId
      : null
  }
  const busy = new Set<string>()
  const active = environmentOf(state.activeWorktreeId)
  if (active) {
    busy.add(active)
  }
  for (const entry of Object.values(state.agentStatusByPaneKey ?? {})) {
    const environmentId = entry.state === 'working' ? environmentOf(entry.worktreeId) : null
    if (environmentId) {
      busy.add(environmentId)
    }
  }
  return [...busy].sort().join(',')
}

/**
 * Tells main which cloud workspaces must stay awake: the one open here and any with a working
 * agent. Sent on change and every 30 seconds, so main's idle clock only runs while neither holds.
 */
export function useReportCloudActivity(
  useStore: <T>(selector: (state: Parameters<typeof busyCloudEnvironmentIds>[0]) => T) => T
): void {
  useCloudEnvironmentIds()
  const busy = useStore(busyCloudEnvironmentIds)
  React.useEffect(() => {
    const send = (): void => {
      void window.api.cloud?.reportActivity(busy ? busy.split(',') : [])
    }
    send()
    const timer = window.setInterval(send, ACTIVITY_REPORT_MS)
    return () => window.clearInterval(timer)
  }, [busy])
}
