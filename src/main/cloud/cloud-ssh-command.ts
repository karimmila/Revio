import { listEphemeralVmRuntimes } from '../../shared/ephemeral-vm-runtime-store'
import { VERCEL_CLOUD_RECIPE_ID } from '../../shared/cloud/cloud-recipe'
import type { SshTarget } from '../../shared/ssh-types'
import { quotePosixShellUnlessPlain } from '../../shared/shell/launch/shell-argument-quoting'
import { buildPlainSshTerminalArgs } from '../ssh/plain-ssh-terminal/plain-ssh-terminal-args'
import { getSshTargetRegistryStore } from '../ssh/targets/ssh-target-registry'

/** A command line a person can paste into their own terminal; the key stays in Orca's data folder. */
export function sshCommandLine(target: SshTarget): string {
  return ['ssh', ...buildPlainSshTerminalArgs(target)].map(quotePosixShellUnlessPlain).join(' ')
}

/**
 * "Copy SSH command" for a cloud workspace: the same ssh route Orca uses (its key,
 * the WebSocket proxy, the pinned host key), so it works while the sandbox runs.
 */
export function cloudSshCommand(userDataPath: string, environmentId: string): string {
  const runtime = listEphemeralVmRuntimes(userDataPath).find(
    (entry) =>
      entry.recipeId === VERCEL_CLOUD_RECIPE_ID &&
      entry.runtimeEnvironmentId === environmentId &&
      entry.status === 'running'
  )
  const target = runtime?.sshTargetId
    ? getSshTargetRegistryStore()?.getTarget(runtime.sshTargetId)
    : undefined
  if (!target) {
    throw new Error('This workspace has no running cloud sandbox. Open it first.')
  }
  return sshCommandLine(target)
}
