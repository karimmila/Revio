import { defineMethod } from '../../../core'
import {
  restoreTurnCheckpoint,
  saveTurnCheckpoint
} from '../../../../../git/checkpoints/turn-checkpoints'
import {
  GitTurnCheckpointRestore,
  GitTurnCheckpointSave
} from '../../../../../../shared/rpc-contract/git-params'

/** Per-turn checkpoints run on the host that owns the worktree (an SSH or cloud runtime too). */
export const GIT_TURN_CHECKPOINT_METHODS = [
  defineMethod({
    name: 'git.turnCheckpointSave',
    permission: 'workspace',
    params: GitTurnCheckpointSave,
    handler: async (params, { runtime }) =>
      runtime.runTurnCheckpoint(params.worktree, (path, options) =>
        saveTurnCheckpoint(path, params.sessionId, options)
      )
  }),
  defineMethod({
    name: 'git.turnCheckpointRestore',
    permission: 'workspace',
    params: GitTurnCheckpointRestore,
    handler: async (params, { runtime }) =>
      runtime.runTurnCheckpoint(params.worktree, (path, options) =>
        restoreTurnCheckpoint(path, params.sessionId, params.before, options)
      )
  })
]
