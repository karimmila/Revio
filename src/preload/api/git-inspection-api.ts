import type {
  GitBranchCompareResult,
  GitCommitCompareResult,
  GitDiffResult
} from '../../shared/git/diff/git-diff-compare-types'
import type { GitMutationInFlight } from '../../shared/git/commands/git-mutation-in-flight'
import type {
  GitConflictOperation,
  GitStagingArea,
  GitStatusResult,
  GitUpstreamStatus
} from '../../shared/git/status/git-status-types'
import type { GitPushTarget } from '../../shared/worktree/types'
import type {
  GitHistoryOptions,
  GitHistoryResult
} from '../../shared/git/history/git-history-types'
import type {
  CommitMessageAgentCapability,
  CommitMessageModelCapability
} from '../../shared/source-control/ai/generation/commit-message-agent-spec'
import type { GraphiteStack } from '../../shared/git/graphite-stack-types'

export type GitInspectionApi = {
  status: (args: {
    worktreePath: string
    connectionId?: string
    admissionTier?: 'interactive' | 'status' | 'background'
    includeIgnored?: boolean
    includeLineStats?: boolean
    bypassEffectiveUpstreamNegativeCache?: boolean
    reuseLineStats?: boolean
    /** Merge-base OID to measure the branch line total against; omit to skip the work. */
    branchLineTotalMergeBase?: string
    requestToken?: string
    /** The active workspace's first status: a user act that may start its WSL distro. */
    wakeWslDistro?: boolean
  }) => Promise<GitStatusResult>
  cancelStatus: (args: { requestToken: string }) => Promise<void>
  setStatusUpstreamRefWatch: (args: {
    worktreeId: string
    worktreePath: string
    executionHostId: string
    connectionId?: string
    branch?: string
    upstreamName?: string
  }) => Promise<void>
  submoduleStatus: (args: {
    worktreePath: string
    submodulePath: string
    connectionId?: string
    area?: GitStagingArea
  }) => Promise<GitStatusResult>
  checkIgnored: (args: {
    worktreePath: string
    paths: string[]
    connectionId?: string
  }) => Promise<string[]>
  findHugeFoldersToIgnore: (args: { worktreePath: string }) => Promise<string[]>
  history: (
    args: {
      worktreePath: string
      connectionId?: string
      wakeWslDistro?: boolean
    } & GitHistoryOptions
  ) => Promise<GitHistoryResult>
  conflictOperation: (args: {
    worktreePath: string
    connectionId?: string
  }) => Promise<GitConflictOperation>
  mutationInFlight: (args: {
    worktreePath: string
    connectionId?: string
  }) => Promise<GitMutationInFlight>
  diff: (args: {
    worktreePath: string
    filePath: string
    staged: boolean
    compareAgainstHead?: boolean
    oldPath?: string
    connectionId?: string
    wakeWslDistro?: boolean
  }) => Promise<GitDiffResult>
  branchCompare: (args: {
    worktreePath: string
    baseRef: string
    connectionId?: string
    admissionTier?: 'interactive' | 'status' | 'background'
  }) => Promise<GitBranchCompareResult>
  /** Files `headRef` changes against its merge base with `baseRef`; neither needs to be HEAD. */
  refCompare: (args: {
    worktreePath: string
    baseRef: string
    headRef: string
    connectionId?: string
  }) => Promise<GitBranchCompareResult>
  /** The worktree's Graphite stack from `gt state`; null without gt or outside a stack. Local only. */
  graphiteStack: (args: { worktreePath: string; connectionId?: string }) => Promise<GraphiteStack>
  /** Switches the worktree to another branch of its Graphite stack. */
  graphiteCheckout: (args: { worktreePath: string; branch: string }) => Promise<void>
  commitCompare: (args: {
    worktreePath: string
    commitId: string
    connectionId?: string
  }) => Promise<GitCommitCompareResult>
  upstreamStatus: (args: {
    worktreePath: string
    connectionId?: string
    pushTarget?: GitPushTarget
  }) => Promise<GitUpstreamStatus>
  branchDiff: (args: {
    worktreePath: string
    compare: {
      baseRef: string
      baseOid: string
      headOid: string
      mergeBase: string
    }
    filePath: string
    oldPath?: string
    connectionId?: string
    wakeWslDistro?: boolean
  }) => Promise<GitDiffResult>
  commitDiff: (args: {
    worktreePath: string
    commitOid: string
    parentOid?: string | null
    filePath: string
    oldPath?: string
    connectionId?: string
    wakeWslDistro?: boolean
  }) => Promise<GitDiffResult>
  discoverCommitMessageModels: (args: {
    agentId: string
    worktreePath?: string
    connectionId?: string
  }) => Promise<
    | {
        success: true
        capability: CommitMessageAgentCapability
        models: CommitMessageModelCapability[]
        defaultModelId: string
        catalogOrigin: 'probe' | 'spec'
      }
    | { success: false; error: string }
  >
  remoteFileUrl: (args: {
    worktreePath: string
    relativePath: string
    line: number
    endLine?: number
    connectionId?: string
  }) => Promise<string | null>
  remoteCommitUrl: (args: {
    worktreePath: string
    sha: string
    connectionId?: string
  }) => Promise<string | null>
}
