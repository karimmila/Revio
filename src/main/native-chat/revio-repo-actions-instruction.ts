import type { RepoAction } from '../../shared/actions/repo-actions'
import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import { DEV_COMMAND_NAME } from '../cli/cli-install-constants'
import { FORK_PRODUCT_NAME, FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

/**
 * The command that reaches this app's CLI. A development build's CLI is `orca-dev`: the packaged
 * command can resolve to an installed release (shell startup files reorder PATH) that lacks newer
 * commands.
 */
export function orcaCliCommand(): string {
  return hasAppEnvironment() && !getAppEnvironment().isPackaged()
    ? DEV_COMMAND_NAME
    : FORK_CLI_COMMAND_NAME
}

function howToRun(cli: string): string {
  return `When the user asks for one, run it with \`${cli} action run "<name>"\` instead of typing its script yourself: it starts in the workspace's Run tab, where the user sees it, and prints a terminal handle. Read its output with \`${cli} terminal read --terminal <handle>\`, or add \`--wait\` to wait for the script to finish and print its last lines.`
}

/** Codex's instructions are set once per app-server, so it learns only how to find the actions. */
export function repoActionsGenericInstruction(cli: string = orcaCliCommand()): string {
  return [
    'This workspace may have repository actions: named scripts the user runs from the Run button, such as a dev server or a tunnel.',
    `List them with \`${cli} action list\`.`,
    howToRun(cli)
  ].join(' ')
}

const MAX_LISTED_ACTIONS = 12
const MAX_NAME_LENGTH = 60
const MAX_SUMMARY_LENGTH = 80

function cut(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

/** The script's first line that is not blank or a comment, as a one-line hint of what it does. */
export function summarizeActionScript(script: string): string {
  const first = script
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('#'))
  return cut(first ?? '', MAX_SUMMARY_LENGTH)
}

/**
 * What a Claude chat learns about its repository's actions at launch: each name, where it runs and
 * a one-line summary of its script, at most a dozen, then how to run one. Without actions it gets
 * the generic note, since actions can be added while the chat runs.
 */
export function repoActionsInstruction(
  actions: readonly Pick<RepoAction, 'name' | 'script' | 'targets'>[],
  cli: string = orcaCliCommand()
): string {
  if (actions.length === 0) {
    return repoActionsGenericInstruction(cli)
  }
  const listed = actions.slice(0, MAX_LISTED_ACTIONS).map((action) => {
    const summary = summarizeActionScript(action.script)
    return `- "${cut(action.name, MAX_NAME_LENGTH)}" (${action.targets.join(', ') || 'nowhere'})${summary ? `: ${summary}` : ''}`
  })
  const more =
    actions.length > MAX_LISTED_ACTIONS
      ? [`- … and ${actions.length - MAX_LISTED_ACTIONS} more (see \`${cli} action list\`)`]
      : []
  return [
    'This workspace has repository actions, named scripts the user runs from the Run button (where each can run in parentheses):',
    ...listed,
    ...more,
    `${howToRun(cli)} \`${cli} action list\` shows each full script and whether it can run in this workspace.`
  ].join('\n')
}

/**
 * What a cloud workspace's agent learns about the repository's actions. It runs inside the
 * sandbox, whose Orca server cannot reach this Mac's Run tab, so instead of `orca action run` it
 * gets each cloud action as a script file and is told to run it itself and say so.
 */
export function cloudRepoActionsInstruction(
  actions: readonly Pick<RepoAction, 'name' | 'script' | 'targets'>[],
  scriptPath: (index: number) => string
): string {
  const cloud = actions.filter((action) => action.targets.includes('cloud'))
  if (cloud.length === 0) {
    return `This repository has no ${FORK_PRODUCT_NAME} actions that run in a cloud workspace.`
  }
  const listed = cloud.slice(0, MAX_LISTED_ACTIONS).map((action, index) => {
    const summary = summarizeActionScript(action.script)
    return `- "${cut(action.name, MAX_NAME_LENGTH)}"${summary ? `: ${summary}` : ''} (run: \`bash -l ${scriptPath(index)}\`)`
  })
  const more =
    cloud.length > MAX_LISTED_ACTIONS
      ? [
          `- … and ${cloud.length - MAX_LISTED_ACTIONS} more, run from ${FORK_PRODUCT_NAME}'s Run button only`
        ]
      : []
  return [
    `This cloud workspace has repository actions, named scripts the user runs from the Run button in ${FORK_PRODUCT_NAME}:`,
    ...listed,
    ...more,
    `You run inside the cloud sandbox, which cannot start ${FORK_PRODUCT_NAME}'s Run tab, so there is no \`${FORK_CLI_COMMAND_NAME} action run\` here. When the user asks for one, run its command yourself: it starts in the repository folder with the variables the Run tab gives it. Start a server in the background (\`nohup bash -l <file> > /tmp/<name>.log 2>&1 &\`) and read its log. Its output also shows in the workspace's Run tab in ${FORK_PRODUCT_NAME}, under the action's name, while the user has the workspace open.`
  ].join('\n')
}
