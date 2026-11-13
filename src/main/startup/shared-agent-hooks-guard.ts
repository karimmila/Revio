import { app } from 'electron'
import { declareAgentStatusHooksUnavailable } from '../../shared/agent-hook-listener/configuration/agent-status-hooks-availability'

/**
 * An installed app shares its agent hooks folder with the upstream app, so it must never install,
 * rewrite or remove hooks (see the availability module). A source build keeps managing them.
 * Call before anything reads settings or runs the uninstall hook removal.
 */
export function leaveSharedAgentHooksAloneWhenInstalled(): void {
  if (app.isPackaged) {
    declareAgentStatusHooksUnavailable()
  }
}
