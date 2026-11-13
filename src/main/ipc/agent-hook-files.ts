import { ipcMain } from 'electron'
import type { AgentHookInstallStatus } from '../../shared/agent-hook-listener/configuration/agent-hook-types'
import { isAgentStatusHooksAvailable } from '../../shared/agent-hook-listener/configuration/agent-status-hooks-availability'

/** The agent settings files that hold this app's status hook entries. */
export function listManagedHookFiles(statuses: readonly AgentHookInstallStatus[]): string[] {
  return statuses
    .filter((status) => status.managedHooksPresent && status.configPath)
    .map((status) => status.configPath)
}

/** Read-only: Settings names every file before and after the person turns the hooks on or off. */
export function registerAgentHookFilesHandler(): void {
  ipcMain.removeHandler('agentStatus:listManagedHookFiles')
  ipcMain.removeHandler('agentStatus:statusHooksAvailable')
  // False in a build that must leave the hooks alone: Settings then shows no switch and no Remove.
  ipcMain.handle('agentStatus:statusHooksAvailable', () => isAgentStatusHooksAvailable())
  ipcMain.handle('agentStatus:listManagedHookFiles', async () => {
    if (!isAgentStatusHooksAvailable()) {
      return []
    }
    // Loaded on demand: the hook services of every agent are not needed until Settings asks.
    const { getManagedAgentHookStatuses } =
      await import('../agent-hooks/managed-agent-hook-controls')
    return listManagedHookFiles(getManagedAgentHookStatuses())
  })
}
