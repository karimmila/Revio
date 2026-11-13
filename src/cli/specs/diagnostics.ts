import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

export const DIAGNOSTICS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['diagnostics', 'memory'],
    summary: `Collect a memory snapshot for ${FORK_PRODUCT_NAME} and managed terminals`,
    usage: 'orca diagnostics memory [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Runs the same host process sweep used by the Resource Usage popover, so call it when you need a point-in-time diagnostic rather than a cheap heartbeat.'
    ],
    examples: ['orca diagnostics memory --json']
  }
]
