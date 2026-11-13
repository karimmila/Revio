import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { runQuickCommandInNewTab } from '@/lib/run-quick-command-in-new-tab'
import { cloudEnvironmentIdsNow, isCloudRepo } from '@/lib/cloud-workspaces'
import { isDockTabForWorkspace } from './revio-dock-terminals'
import { startInRevioDockInBackground } from './revio-dock-background-start'
import { prepareCloudDockForWorktree } from './revio-cloud-dock'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { isRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import { IMPORTED_SCRIPT_ENV } from '../../../../shared/import-source-app'

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`

/**
 * "Rerun setup": the workspace's setup script again, in a "Setup" tab. A cloud
 * workspace's script waits in its sandbox; a local one reruns the runner Orca wrote into the
 * worktree's git dir at create, with the variables the create gave it.
 */
export async function rerunRevioSetup(worktreeId: string): Promise<boolean> {
  const state = useAppStore.getState()
  const worktree = findWorktreeById(selectWorktreesByRepo(state), worktreeId)
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  if (!worktree || !repo) {
    return false
  }
  const cloud = isCloudRepo(repo, cloudEnvironmentIdsNow())
  if (cloud) {
    await prepareCloudDockForWorktree(worktreeId)
  }
  const command = cloud
    ? 'test -f /vercel/.orca-cloud-setup.sh && bash /vercel/.orca-cloud-setup.sh'
    : [
        `runner="$(git rev-parse --git-path orca/setup-runner.sh)"`,
        `if [ -f "$runner" ]; then ORCA_ROOT_PATH=${quote(repo.path)} ORCA_WORKTREE_PATH=${quote(worktree.path)} ${IMPORTED_SCRIPT_ENV.rootPath}=${quote(repo.path)} bash "$runner"; else echo "This workspace has no setup script."; fi`
      ].join('; ')
  const title = translate('auto.components.revioLayout.setupTab', 'Setup')
  if (startInRevioDockInBackground(worktreeId, title, command) !== null) {
    return true
  }
  const result = runQuickCommandInNewTab({
    command: {
      id: 'revio:setup',
      label: translate('auto.components.revioLayout.setupTab', 'Setup'),
      command,
      appendEnter: true
    },
    worktreeId
  })
  if (!result) {
    toast.error(translate('auto.components.revioLayout.rerunSetupFailed', 'Could not rerun setup'))
  }
  return result !== null
}

/** The workspace's Setup tabs (its own and the dock's), each with the local PTYs it holds. */
export function revioSetupTabs(worktreeId: string): { tabId: string; localPtyIds: string[] }[] {
  const state = useAppStore.getState()
  const titles = new Set([
    translate('auto.components.revioLayout.setupTab', 'Setup'),
    translate('worktree.setupTerminalTitle', 'Setup')
  ])
  return [
    ...(state.tabsByWorktree[worktreeId] ?? []),
    ...(state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).filter((tab) =>
      isDockTabForWorkspace(tab.id, worktreeId)
    )
  ]
    .filter((tab) => tab.customTitle !== null && titles.has(tab.customTitle))
    .map((tab) => ({
      tabId: tab.id,
      localPtyIds: Object.values(state.terminalLayoutsByTabId[tab.id]?.ptyIdsByLeafId ?? {}).filter(
        (id): id is string => !!id && !isRemoteRuntimePtyId(id)
      )
    }))
}

/**
 * "Stop setup": interrupts the workspace's running setup (⌃C in its Setup tab, the
 * dock's or the one created with the workspace), keeping its output. A cloud workspace's Setup
 * tab has no local process to signal, so it closes. Returns false when no Setup tab is open.
 */
export function stopRevioSetup(worktreeId: string): boolean {
  const tabs = revioSetupTabs(worktreeId)
  for (const tab of tabs) {
    if (tab.localPtyIds.length > 0) {
      tab.localPtyIds.forEach((id) => window.api.pty.write(id, '\x03', 'driving'))
    } else {
      useAppStore.getState().closeTab(tab.tabId)
    }
  }
  return tabs.length > 0
}
