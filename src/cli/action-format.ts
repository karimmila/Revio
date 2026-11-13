import type { ActionWaitResult } from './action-run-wait'
import type {
  RepoActionListResult,
  RepoActionRunResult
} from '../shared/actions/repo-action-agent-results'
import { FORK_PRODUCT_NAME, FORK_CLI_COMMAND_NAME } from '../shared/fork-identity'

const SCRIPT_PREVIEW_LINES = 2
const SCRIPT_PREVIEW_WIDTH = 100

/** The first lines of a script, skipping blanks and comments, each cut to one terminal row. */
export function scriptPreview(script: string, lines = SCRIPT_PREVIEW_LINES): string[] {
  const meaningful = script
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  const shown = meaningful
    .slice(0, lines)
    .map((line) =>
      line.length > SCRIPT_PREVIEW_WIDTH ? `${line.slice(0, SCRIPT_PREVIEW_WIDTH - 1)}…` : line
    )
  if (meaningful.length > lines) {
    shown.push(`… (${meaningful.length - lines} more lines; --json has the full script)`)
  }
  return shown
}

export function formatActionList(result: RepoActionListResult): string {
  const header = `Workspace location: ${result.location}${result.runMode === 'nonconcurrent' ? ' (nonconcurrent: a run stops this repository’s runs in other workspaces)' : ''}`
  const warning = result.sharedError
    ? `\nCould not read the repository's shared actions file: ${result.sharedError}`
    : ''
  if (result.actions.length === 0) {
    return `${header}${warning}\nThis repository has no actions. Add them in ${FORK_PRODUCT_NAME}: Settings, the repository, Actions.`
  }
  const rows = result.actions.map((action) => {
    const where = action.runsIn.length > 0 ? action.runsIn.join(',') : 'not here'
    const preview = scriptPreview(action.script).map((line) => `    ${line}`)
    return [`${action.name}  id=${action.id}  runs=${where}`, ...preview].join('\n')
  })
  return `${header}${warning}\n\n${rows.join('\n\n')}\n\nRun one with: ${FORK_CLI_COMMAND_NAME} action run "<name>"`
}

export type ActionRunOutput = RepoActionRunResult & { wait?: ActionWaitResult }

export function formatActionRun(result: ActionRunOutput): string {
  const lines = [
    result.alreadyRunning
      ? `${result.action.name} is already running (pass --restart to start it again).`
      : `Started ${result.action.name} in the Run tab (${result.location}).`,
    result.terminal
      ? `terminal=${result.terminal}\nRead output: ${FORK_CLI_COMMAND_NAME} terminal read --terminal ${result.terminal}`
      : `The Run terminal did not report a handle yet; find it with \`${FORK_CLI_COMMAND_NAME} terminal list\`.`
  ]
  if (result.wait) {
    lines.push(
      result.wait.finished
        ? `The script finished${result.wait.exitCode === null ? '' : ` with exit code ${result.wait.exitCode}`}.`
        : result.wait.timedOut
          ? 'Still running at the timeout.'
          : 'Could not tell whether the script finished.',
      '--- output (last lines) ---',
      ...result.wait.tail
    )
  }
  return lines.join('\n')
}
