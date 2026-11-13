import { FORK_CLI_COMMAND_NAME } from '../../shared/fork-identity'

/**
 * New sandboxes carry the fork's name. Existing `orca-…` ones keep theirs: every later call finds a
 * sandbox by the name stored in its runtime's userData, never by rebuilding it from the instance id.
 */
export function workspaceSandboxName(instanceId: string): string {
  return `${FORK_CLI_COMMAND_NAME}-${instanceId.replace(/^orca-/, '').slice(0, 18)}`
}
