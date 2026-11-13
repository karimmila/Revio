import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { isHomeFolderProject } from '@/lib/revio-create-default-repo'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'
import type { VercelCloudStatus } from '../../../../../shared/vercel-cloud/vercel-cloud-types'
import type { SetupStatus, SetupStatuses } from './workspace-setup-steps'
import type { ClaudeLoginRoute } from '../../../../../shared/claude-login-route'
import {
  agentSetupStatus,
  claudeMacLoginStatus,
  githubSetupStatus,
  projectSetupStatus,
  vercelSetupStatus
} from './workspace-setup-status'

export type WorkspaceSetupLive = {
  statuses: SetupStatuses
  claudeMac: SetupStatus
  /** The login a Claude launch on this Mac uses; null while unknown. */
  claudeRoute: ClaudeLoginRoute | null
  /** Whether a sealed setup-token is saved; null while unknown. Never the token itself. */
  claudeCloudTokenSet: boolean | null
  vercel: VercelCloudStatus | null
  github: CloudGithubStatus | null
  /** Re-reads every status; `claudeUsage` also re-polls Claude's usage meter. */
  refresh: (options?: { claudeUsage?: boolean }) => void
  setVercel: (status: VercelCloudStatus) => void
}

const unknownVercel: VercelCloudStatus = { state: 'disconnected' }
const noGithub: CloudGithubStatus = {
  app: { configured: false, message: '' },
  account: null,
  signInExpired: false,
  signIn: null,
  repos: [],
  pendingInstallOwner: null,
  coverageError: null,
  migrated: false
}

/**
 * Live connection state for each step, from the calls Settings already uses. Re-read when the
 * window regains focus, since most connections finish in the browser.
 */
export function useWorkspaceSetupStatuses(): WorkspaceSetupLive {
  // The "~" folder Orca seeds on first run is not a project the person added.
  const repoCount = useAppStore((s) => s.repos.filter((repo) => !isHomeFolderProject(repo)).length)
  const refreshRateLimits = useAppStore((s) => s.refreshRateLimits)
  const [claudeCloudTokenSet, setClaudeCloudTokenSet] = useState<boolean | null>(null)
  const [vercel, setVercel] = useState<VercelCloudStatus | null>(null)
  const [github, setGithub] = useState<CloudGithubStatus | null>(null)
  const [claudeRoute, setClaudeRoute] = useState<ClaudeLoginRoute | null>(null)

  const readConnections = useCallback(() => {
    const cloud = window.api.cloud
    const vercelApi = window.api.vercelCloud
    void (window.api.claudeAccounts?.loginRoute() ?? Promise.resolve<ClaudeLoginRoute>('none'))
      .then(setClaudeRoute)
      .catch(() => setClaudeRoute('none'))
    void (cloud?.claudeTokenSet() ?? Promise.resolve(false))
      .then(setClaudeCloudTokenSet)
      .catch(() => setClaudeCloudTokenSet(false))
    void (vercelApi?.status() ?? Promise.resolve(unknownVercel))
      .then(setVercel)
      .catch((error: unknown) =>
        setVercel({ state: 'error', message: error instanceof Error ? error.message : '' })
      )
    void (cloud?.githubStatus() ?? Promise.resolve(noGithub))
      .then(setGithub)
      .catch(() => setGithub(noGithub))
  }, [])

  useEffect(() => {
    readConnections()
  }, [readConnections])

  useEffect(() => {
    const onFocus = (): void => readConnections()
    window.addEventListener('focus', onFocus)
    const offGithub = window.api.cloud?.onGithubEvent(() => readConnections())
    return () => {
      window.removeEventListener('focus', onFocus)
      offGithub?.()
    }
  }, [readConnections])

  const claudeMac = claudeMacLoginStatus(claudeRoute)
  const statuses = useMemo<SetupStatuses>(
    () => ({
      agent: agentSetupStatus(claudeMac, claudeCloudTokenSet),
      cloud: vercelSetupStatus(vercel),
      project: projectSetupStatus(repoCount),
      github: githubSetupStatus(github)
    }),
    [claudeCloudTokenSet, claudeMac, github, repoCount, vercel]
  )

  const refresh = useCallback(
    (options?: { claudeUsage?: boolean }) => {
      readConnections()
      if (options?.claudeUsage) {
        void refreshRateLimits()
      }
    },
    [readConnections, refreshRateLimits]
  )

  return {
    statuses,
    claudeMac,
    claudeRoute,
    claudeCloudTokenSet,
    vercel,
    github,
    refresh,
    setVercel
  }
}
