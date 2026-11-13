import type { ClaudeLoginRoute } from '../../../../../shared/claude-login-route'
import type { VercelCloudStatus } from '../../../../../shared/vercel-cloud/vercel-cloud-types'
import type { CloudGithubStatus } from '../../../../../shared/cloud/cloud-types'
import type { SetupStatus } from './workspace-setup-steps'

/**
 * Claude on this Mac follows the same rule as a Claude launch: an app-managed account, an API key,
 * or Claude Code's own login all let agents run; only none of them asks for a sign-in.
 */
export function claudeMacLoginStatus(route: ClaudeLoginRoute | null): SetupStatus {
  if (route === null) {
    return 'checking'
  }
  return route === 'none' ? 'not-connected' : 'connected'
}

/** Either login lets agents run: the Mac's CLI login locally, the setup-token in the cloud. */
export function agentSetupStatus(mac: SetupStatus, cloudTokenSet: boolean | null): SetupStatus {
  if (mac === 'connected' || cloudTokenSet === true) {
    return 'connected'
  }
  return mac === 'checking' || cloudTokenSet === null ? 'checking' : 'not-connected'
}

/** Signed in but with no team picked is not connected yet: nothing runs until a team is chosen. */
export function vercelSetupStatus(status: VercelCloudStatus | null): SetupStatus {
  if (!status) {
    return 'checking'
  }
  return status.state === 'connected' ? 'connected' : 'not-connected'
}

/**
 * Signed in with the GitHub App and, once a GitHub project exists, the app installed on at least
 * one of them: cloud workspaces can then push somewhere.
 */
export function githubSetupStatus(status: CloudGithubStatus | null): SetupStatus {
  if (!status) {
    return 'checking'
  }
  if (!status.account) {
    return 'not-connected'
  }
  const reachable =
    status.repos.length === 0 || status.repos.some((repo) => repo.state === 'covered')
  return reachable ? 'connected' : 'not-connected'
}

export function projectSetupStatus(repoCount: number): SetupStatus {
  return repoCount > 0 ? 'connected' : 'not-connected'
}
