import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'
import { FORK_PRODUCT_NAME, FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

export const ACTION_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['action', 'list'],
    summary: "List the workspace's repository actions (the Run button's actions)",
    usage: 'orca action list [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree'],
    notes: [
      `Defaults to the ${FORK_PRODUCT_NAME} workspace that contains the current directory.`,
      'Each row shows the action name, its id, where this workspace can run it (local, cloud, mirror, or "not here"), and the first lines of its script.',
      'With --json, result.actions[] has id, name, script (full text), shared, targets and runsIn (empty when it cannot run in this workspace).'
    ],
    examples: ['orca action list', 'orca action list --json']
  },
  {
    path: ['action', 'run'],
    summary: "Run a repository action in the workspace's Run tab, like the Run button",
    usage:
      'orca action run <name-or-id> [--worktree <selector>] [--location local|cloud|mirror] [--restart] [--wait] [--timeout-ms <ms>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'action',
      'worktree',
      'location',
      'restart',
      'wait',
      'timeout-ms'
    ],
    positionalArgs: ['action'],
    notes: [
      `Runs only an action defined for the repository (\`${FORK_CLI_COMMAND_NAME} action list\`), never a script you pass. It starts in the same Run tab, with the same variables and run mode, as clicking it in the Run menu.`,
      `Prints the Run terminal handle; read the output with \`${FORK_CLI_COMMAND_NAME} terminal read --terminal <handle>\`.`,
      'If the action is still running, it is left alone and its handle is printed; pass --restart to stop it and start it again.',
      '--wait waits until the script finishes (default 120000 ms, at most 600000) and prints the last lines of output. A server that keeps running ends the wait at the timeout, still running.',
      'A cloud workspace runs cloud actions in the sandbox and mirror actions in its local mirror; --location picks one when an action can run in both.'
    ],
    examples: [
      'orca action run "Claim tunnel"',
      'orca action run "Run tests" --wait',
      'orca action run shared:0:dev-server --restart --json'
    ]
  }
]
