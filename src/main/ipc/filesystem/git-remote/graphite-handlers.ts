import { ipcMain } from 'electron'
import type { GraphiteStack } from '../../../../shared/git/graphite-stack-types'
import { checkoutGraphiteBranch, readGraphiteStack } from '../../../git/graphite/graphite-stack'
import { resolveRegisteredWorktreePath } from '../../worktrees/removal/registered-worktree-roots-cache'
import type { FilesystemHandlerContext } from '../filesystem-handler-context'

/** The Graphite stack support: local worktrees only (no SSH or WSL hop for `gt`). */
export function registerGraphiteHandlers(context: FilesystemHandlerContext): void {
  const { store } = context
  ipcMain.handle(
    'git:graphiteStack',
    async (
      _event,
      args: { worktreePath: string; connectionId?: string }
    ): Promise<GraphiteStack> => {
      if (args.connectionId) {
        return null
      }
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      return readGraphiteStack(worktreePath)
    }
  )
  ipcMain.handle(
    'git:graphiteCheckout',
    async (_event, args: { worktreePath: string; branch: string }): Promise<void> => {
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      await checkoutGraphiteBranch(worktreePath, String(args.branch))
    }
  )
}
