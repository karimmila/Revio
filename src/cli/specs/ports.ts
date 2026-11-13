import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

export const PORTS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['ports'],
    summary: `List the listening ports ${FORK_PRODUCT_NAME} detected for a workspace`,
    usage: 'orca ports [--worktree <selector>] [--all] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'all'],
    notes: [
      `Defaults to the ${FORK_PRODUCT_NAME} workspace that contains the current directory.`,
      `Scans the host the workspace runs on and lists the ports ${FORK_PRODUCT_NAME} tied to it, by process working directory (match=cwd) or command line (match=command).`,
      `--all lists every listener found on that host, including other workspaces and processes ${FORK_PRODUCT_NAME} could not tie to one. A native folder workspace needs --all, because ${FORK_PRODUCT_NAME} does not tie ports to folders.`,
      `url is the address the dev server printed in a ${FORK_PRODUCT_NAME} terminal; it is missing when ${FORK_PRODUCT_NAME} did not see one.`
    ],
    examples: [
      'orca ports',
      'orca ports --worktree branch:feature/login --json',
      'orca ports --all',
      "orca ports --json | jq -r '.result.ports[0].advertisedUrl'"
    ]
  }
]
