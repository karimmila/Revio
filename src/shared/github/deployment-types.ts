/** A GitHub deployment of a pull request's head commit, with its latest status (Deployments). */
export type PRDeployment = {
  id: number
  environment: string
  /** GitHub's latest deployment status state, lower case: success, failure, error, in_progress, queued, pending, inactive. */
  state: string
  /** Where the deployment is served, else its log, else null. */
  url: string | null
  createdAt: string
}
