import type { PRDeployment } from '../../../../shared/github/deployment-types'

/** "View deployment": each environment's newest live deployment that has a URL. */
export function viewableDeployments(deployments: readonly PRDeployment[]): PRDeployment[] {
  const newest = new Map<string, PRDeployment>()
  for (const deployment of deployments) {
    const seen = newest.get(deployment.environment)
    if (!seen || deployment.createdAt > seen.createdAt) {
      newest.set(deployment.environment, deployment)
    }
  }
  return [...newest.values()].filter(
    (deployment) => deployment.state === 'success' && deployment.url !== null
  )
}
