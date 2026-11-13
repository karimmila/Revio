import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

/** `pr push`: the caller's own workspace, never a remote or a refspec. */
export const PullRequestPushParams = z.object({
  worktree: requiredString('Missing worktree selector')
})

/** `pr create`: the head is always the workspace's current branch, so it is not a parameter. */
export const PullRequestCreateParams = z.object({
  worktree: requiredString('Missing worktree selector'),
  title: requiredString('Missing --title').pipe(z.string().max(256)),
  body: z.string().max(65_536).optional(),
  base: z.string().min(1).max(255).optional(),
  draft: z.boolean().optional()
})

/** `pr checks`: the pull request of the workspace's current branch; `logs` adds failing job logs. */
export const PullRequestChecksParams = z.object({
  worktree: requiredString('Missing worktree selector'),
  logs: z.boolean().optional()
})

export type PullRequestPushResult = { branch: string }

export type PullRequestCreateResult = {
  url: string
  number: number | null
  branch: string
  /** False when the branch already had a pull request: the push updated it. */
  created: boolean
}

export type PullRequestCheckState = 'failed' | 'running' | 'passed' | 'skipped'

export type PullRequestCheckSummary = {
  name: string
  state: PullRequestCheckState
  url: string | null
}

export type PullRequestFailingJob = {
  name: string
  failedSteps: string[]
  /** The end of the job's log, where the failure is; null when GitHub has none to give. */
  log: string | null
}

export type PullRequestFailingCheck = {
  name: string
  url: string | null
  summary: string | null
  annotations: string[]
  jobs: PullRequestFailingJob[]
}

export type PullRequestChecksResult = {
  url: string
  number: number
  branch: string
  checks: PullRequestCheckSummary[]
  /** Present only with `logs`: one entry per failing check, up to the limit. */
  failing?: PullRequestFailingCheck[]
  /** Failing checks left out of `failing` because the limit was reached. */
  failingOmitted?: number
}
