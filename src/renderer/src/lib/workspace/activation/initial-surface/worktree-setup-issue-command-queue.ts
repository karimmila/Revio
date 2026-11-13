import type { WorktreeSetupLaunch } from '../../../../../../shared/worktree/launch-types'
import { buildSetupRunnerCommand } from '../../../setup-runner'
import { translate } from '@/i18n/i18n'
import { startInRevioDockInBackground } from '@/components/revio-layout/revio-dock-background-start'
import type {
  InitialTerminalOptions,
  WorktreeActivationStore
} from '@/lib/workspace/activation/worktree-activation-store-contract'

// Accept main runner files and expanded TaskPage commands without synthesizing another script.
export type IssueCommandLaunch =
  | WorktreeSetupLaunch
  | { command: string; env?: Record<string, string> }

function setupCommandOf(
  setup: WorktreeSetupLaunch | undefined,
  wrappedSetupCommandStr: string | undefined
): { command: string; env?: Record<string, string> } | null {
  return setup
    ? {
        command:
          wrappedSetupCommandStr ??
          setup.command ??
          buildSetupRunnerCommand(setup.runnerScriptPath, setup.shell),
        env: setup.envVars
      }
    : null
}

// The workspace layout shows setup in its bottom panel beside Run, and starts it at create whether
// the panel shows or not; a background create's setup docks too.
function startSetupInRevioDock(
  worktreeId: string,
  setupCommand: { command: string; env?: Record<string, string> }
): boolean {
  return (
    startInRevioDockInBackground(
      worktreeId,
      translate('auto.components.revioLayout.setupTab', 'Setup'),
      setupCommand.command,
      setupCommand.env
    ) !== null
  )
}

/**
 * Starts setup in the dock now, needing no terminal of the workspace's own: false when
 * the dock cannot take it (outside the workspace layout, or no route to the host).
 */
export function startDockedSetupNow(
  worktreeId: string,
  setup: WorktreeSetupLaunch | undefined,
  wrappedSetupCommandStr: string | undefined
): boolean {
  const setupCommand = setupCommandOf(setup, wrappedSetupCommandStr)
  return setupCommand !== null && startSetupInRevioDock(worktreeId, setupCommand)
}

export function queueSetupAndIssueCommands(
  store: WorktreeActivationStore,
  worktreeId: string,
  /** Null when the caller opens its own primary surface: setup still gets its own tab, with no terminal selection to restore. */
  terminalTabId: string | null,
  setup: WorktreeSetupLaunch | undefined,
  issueCommand: IssueCommandLaunch | undefined,
  wrappedSetupCommandStr: string | undefined,
  opts: InitialTerminalOptions | undefined
): void {
  const setupCommand = setupCommandOf(setup, wrappedSetupCommandStr)
  const docked = setupCommand !== null && startSetupInRevioDock(worktreeId, setupCommand)
  if (setupCommand && !docked) {
    const setupTab = store.createTab(worktreeId, undefined, undefined, {
      recordInteraction: false,
      ...(opts?.activateCreatedTabs === false ? { activate: false } : {}),
      pendingStartup: setupCommand
    })
    // createTab auto-activates; restore primary focus while Setup runs in background.
    if (opts?.activateCreatedTabs !== false && terminalTabId) {
      store.setActiveTab(terminalTabId)
    }
    store.setTabCustomTitle(setupTab.id, translate('worktree.setupTerminalTitle', 'Setup'), {
      recordInteraction: false
    })
  }

  // Queue issue work independently in its own split so setup and automation run in parallel.
  if (issueCommand && terminalTabId) {
    // Why: WorktreeSetupLaunch carries a runner-script file to shell out to; the TaskPage variant is already an expanded command string.
    const queuedIssueCommand =
      'runnerScriptPath' in issueCommand
        ? {
            command: buildSetupRunnerCommand(issueCommand.runnerScriptPath, issueCommand.shell),
            env: issueCommand.envVars
          }
        : { command: issueCommand.command, env: issueCommand.env }
    store.queueTabIssueCommandSplit(terminalTabId, queuedIssueCommand)
  }
}
