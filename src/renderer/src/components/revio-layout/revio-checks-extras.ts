import type { PRCheckDetail } from '../../../../shared/github/check-types'
import type { PRDeployment } from '../../../../shared/github/deployment-types'

const FAILED = new Set(['failure', 'cancelled', 'timed_out'])

/** Checks "Re-run failed checks" would restart (the rerun's own filter in main). */
export function failedCheckCount(checks: readonly PRCheckDetail[]): number {
  return checks.filter((check) => FAILED.has(check.conclusion ?? '')).length
}

export type DeploymentTone = 'deployed' | 'deploying' | 'failed' | 'pending' | 'inactive'

/** The deployment labels: Deployed, Deploying, Failed, Pending, Inactive. */
export function deploymentTone(deployment: PRDeployment): DeploymentTone {
  switch (deployment.state) {
    case 'success':
      return 'deployed'
    case 'failure':
    case 'error':
      return 'failed'
    case 'in_progress':
      return 'deploying'
    case 'inactive':
      return 'inactive'
    default:
      return 'pending'
  }
}
