import { ipcMain } from 'electron'
import { z } from 'zod'
import { resolveRegisteredWorktreePath } from '../worktrees/removal/registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../local-worktree-runtime-options'
import { restoreTurnCheckpoint, saveTurnCheckpoint } from '../../git/checkpoints/turn-checkpoints'
import type { FilesystemHandlerContext } from './filesystem-handler-context'

const SaveArgs = z.object({
  worktreePath: z.string().min(1).max(4096),
  sessionId: z.string().min(1).max(128)
})
const RestoreArgs = SaveArgs.extend({ before: z.number().int().nonnegative() })

/** Per-turn checkpoints for workspaces on this Mac (registered worktrees only). */
export function registerTurnCheckpointHandlers({ store }: FilesystemHandlerContext): void {
  ipcMain.handle('turnCheckpoint:save', async (_event, raw: unknown) => {
    const args = SaveArgs.parse(raw)
    const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
    const options = getLocalGitOptionsForRegisteredWorktree(store, args.worktreePath, worktreePath)
    return saveTurnCheckpoint(worktreePath, args.sessionId, options)
  })
  ipcMain.handle('turnCheckpoint:restore', async (_event, raw: unknown) => {
    const args = RestoreArgs.parse(raw)
    const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
    const options = getLocalGitOptionsForRegisteredWorktree(store, args.worktreePath, worktreePath)
    return restoreTurnCheckpoint(worktreePath, args.sessionId, args.before, options)
  })
}
