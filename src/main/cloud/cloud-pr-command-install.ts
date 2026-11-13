import type { Sandbox } from '@vercel/sandbox'
import { dirname } from 'node:path/posix'
import { CLOUD_PR_COMMAND_PATH, CLOUD_PR_COMMAND_SCRIPT } from '../../shared/cloud/cloud-pr-command'
import {
  CLOUD_OPEN_URL_COMMAND_PATH,
  CLOUD_OPEN_URL_COMMAND_SCRIPT
} from '../../shared/cloud/cloud-desktop-browser'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'
import { redactSecrets } from './cloud-errors'
import { runSandboxScript } from './cloud-sandbox-run'

/**
 * Puts the sandbox's helper commands (pull request, open a page on the desktop) in place, at create and on each wake, so a sandbox made by
 * an older build gets it and a newer build's fixes arrive. Never fatal: without it the prompt's
 * fallback still names the REST calls.
 */
export async function writeCloudPrCommand(sandbox: Sandbox, signal?: AbortSignal): Promise<void> {
  try {
    await runSandboxScript(sandbox, `mkdir -p ${quotePosixShell(dirname(CLOUD_PR_COMMAND_PATH))}`, {
      signal
    })
    await sandbox.writeFiles(
      [
        { path: CLOUD_PR_COMMAND_PATH, content: CLOUD_PR_COMMAND_SCRIPT, mode: 0o755 },
        { path: CLOUD_OPEN_URL_COMMAND_PATH, content: CLOUD_OPEN_URL_COMMAND_SCRIPT, mode: 0o755 }
      ],
      { signal }
    )
  } catch (error) {
    console.warn(`[cloud] Could not install the sandbox commands: ${redactSecrets(String(error))}`)
  }
}
