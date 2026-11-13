import { ipcMain } from 'electron'
import { pinnedRemotePushTarget, repoIdOfWorktreeId } from '../../../git/pinned-remote'
import type { GitPushTarget } from '../../../../shared/worktree/types'
import { gitFastForward, gitPull, gitPullRebaseFromBase, gitPush } from '../../../git/remote'
import { gitPullLatestFromBase } from '../../../git/revio-pull-latest'
import type { PullLatestOutcome } from '../../../../shared/git/revio-pull-latest'
import { gitContinueOnNewBranch } from '../../../git/revio-continue-branch'
import type { ContinueOnNewBranchResult } from '../../../../shared/git/revio-continue-branch'
import { validateGitPushTarget } from '../../../git/push-target-validation'
import { renameBranchTo } from '../../../git/branch-rename'
import { gitExecFileAsync } from '../../../git/runner'
import { gitOptionsForWorktree } from '../../../git/git-runtime-options'
import { runWithGitReadCacheInvalidation } from '../../../git/source-control/git-read-cache-invalidation'
import { runWithGitWorktreeOperationLock } from '../../../../shared/git/worktrees/git-worktree-operation-lock'
import { resolveRegisteredWorktreePath } from '../../worktrees/removal/registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../../local-worktree-runtime-options'
import { ipcGitWorktreeTarget, materializeWorktreePushTargetRemote } from '../../worktree-remote'
import type { FilesystemHandlerContext } from '../filesystem-handler-context'
import { requireReachableGitRoute } from '../../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../../shared/execution-host'

export function registerGitRemoteBranchMutationHandlers(context: FilesystemHandlerContext): void {
  const { store } = context

  ipcMain.handle(
    'git:push',
    async (
      _event,
      args: {
        worktreePath: string
        worktreeId?: string
        publish?: boolean
        forceWithLease?: boolean
        connectionId?: string
        pushTarget?: GitPushTarget
      }
    ): Promise<void> => {
      // Require literal true so malformed values such as string false cannot enable --set-upstream.
      const publish = args.publish === true
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      const materializedPushTarget = args.pushTarget
        ? await materializeWorktreePushTargetRemote(
            worktreePath,
            args.pushTarget,
            store,
            undefined,
            gitOptions,
            ipcGitWorktreeTarget(args)
          )
        : await pinnedRemotePushTarget(
            worktreePath,
            { repoId: repoIdOfWorktreeId(args.worktreeId) },
            gitOptions
          )
      if (materializedPushTarget) {
        await validateGitPushTarget(worktreePath, materializedPushTarget, {
          ...gitOptions,
          admissionTier: 'interactive'
        })
      }
      await gitPush(worktreePath, publish, materializedPushTarget, {
        forceWithLease: args.forceWithLease === true,
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )

  ipcMain.handle(
    'git:pull',
    async (
      _event,
      args: {
        worktreePath: string
        worktreeId?: string
        connectionId?: string
        pushTarget?: GitPushTarget
      }
    ): Promise<void> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      const materializedPushTarget = args.pushTarget
        ? await materializeWorktreePushTargetRemote(
            worktreePath,
            args.pushTarget,
            store,
            undefined,
            gitOptions,
            ipcGitWorktreeTarget(args)
          )
        : await pinnedRemotePushTarget(
            worktreePath,
            { repoId: repoIdOfWorktreeId(args.worktreeId) },
            gitOptions
          )
      if (materializedPushTarget) {
        await validateGitPushTarget(worktreePath, materializedPushTarget, {
          ...gitOptions,
          admissionTier: 'interactive'
        })
      }
      await gitPull(worktreePath, materializedPushTarget, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )

  ipcMain.handle(
    'git:fastForward',
    async (
      _event,
      args: {
        worktreePath: string
        worktreeId?: string
        connectionId?: string
        pushTarget?: GitPushTarget
      }
    ): Promise<void> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      const materializedPushTarget = args.pushTarget
        ? await materializeWorktreePushTargetRemote(
            worktreePath,
            args.pushTarget,
            store,
            undefined,
            gitOptions,
            ipcGitWorktreeTarget(args)
          )
        : await pinnedRemotePushTarget(
            worktreePath,
            { repoId: repoIdOfWorktreeId(args.worktreeId) },
            gitOptions
          )
      if (materializedPushTarget) {
        await validateGitPushTarget(worktreePath, materializedPushTarget, {
          ...gitOptions,
          admissionTier: 'interactive'
        })
      }
      await gitFastForward(worktreePath, materializedPushTarget, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )

  ipcMain.handle(
    'git:rebaseFromBase',
    async (
      _event,
      args: { worktreePath: string; baseRef: string; connectionId?: string }
    ): Promise<void> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      await gitPullRebaseFromBase(worktreePath, args.baseRef, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )

  ipcMain.handle(
    'git:pullLatestFromBase',
    async (
      _event,
      args: { worktreePath: string; baseRef: string; connectionId?: string }
    ): Promise<PullLatestOutcome> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return gitPullLatestFromBase(worktreePath, args.baseRef, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )

  ipcMain.handle(
    'git:continueOnNewBranch',
    async (
      _event,
      args: { worktreePath: string; baseRef: string; connectionId?: string }
    ): Promise<ContinueOnNewBranchResult> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return gitContinueOnNewBranch(worktreePath, args.baseRef, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )

  ipcMain.handle(
    'git:renameBranch',
    async (
      _event,
      args: { worktreePath: string; newBranch: string; connectionId?: string }
    ): Promise<string> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const options = gitOptionsForWorktree(worktreePath, {
        ...getLocalGitOptionsForRegisteredWorktree(store, args.worktreePath, worktreePath),
        admissionTier: 'interactive'
      })
      return runWithGitWorktreeOperationLock(worktreePath, undefined, () =>
        runWithGitReadCacheInvalidation(() =>
          renameBranchTo((gitArgs) => gitExecFileAsync(gitArgs, options), args.newBranch)
        )
      )
    }
  )
}
