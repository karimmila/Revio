import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const RepoActionListParams = z.object({
  worktree: requiredString('Missing worktree selector')
})

export const RepoActionRunParams = z.object({
  worktree: requiredString('Missing worktree selector'),
  // An action id or name from the repository's actions; a script is never accepted.
  action: requiredString('Missing action name or id').pipe(z.string().max(200)),
  location: z.enum(['local', 'cloud', 'mirror']).optional(),
  restart: z.boolean().optional()
})
