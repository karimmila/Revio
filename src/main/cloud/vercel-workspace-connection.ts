import type { Sandbox } from '@vercel/sandbox'
import { pinHostKey } from '../ssh/pinned-host-keys'
import { sandboxRepoDir } from './cloud-base-image'
import type { GithubRepo } from './cloud-github'
import { runSandboxScript } from './cloud-sandbox-run'
import {
  SANDBOX_SSH_BRIDGE_PORT,
  proxyCommandFor,
  sshStartScript,
  workspaceIdentityFile
} from './cloud-ssh-access'

export type CloudWorkspaceUserData = { branch?: string; startCommit?: string }

/** Starts the sandbox's SSH, pins its host key, and returns the recipe's connection result. */
export async function connectionResult(
  sandbox: Sandbox,
  instanceId: string,
  repo: GithubRepo,
  log: (text: string) => void,
  authorizedKey: string | null,
  signal?: AbortSignal,
  /** The workspace's branch and the commit it started at; archive reads them while it sleeps. */
  workspace: CloudWorkspaceUserData = {}
): Promise<string> {
  const hostKey = (
    await runSandboxScript(sandbox, sshStartScript(authorizedKey), { sudo: true, signal })
  )
    .trim()
    .split('\n')
    .pop()
  if (!hostKey) {
    throw new Error('The sandbox did not report an SSH host key.')
  }
  const host = `${sandbox.name}.sandbox`
  pinHostKey(instanceId, host, hostKey)
  log(`SSH ready, host key pinned for ${host}\n`)
  return JSON.stringify({
    schemaVersion: 2,
    checkoutMode: 'provisioned-root',
    connection: {
      type: 'ssh',
      target: {
        label: `${repo.name} (cloud)`,
        host,
        port: 22,
        username: 'ubuntu',
        identityFile: workspaceIdentityFile(instanceId),
        identitiesOnly: true,
        proxyCommand: proxyCommandFor(sandbox.domain(SANDBOX_SSH_BRIDGE_PORT))
      },
      projectRoot: sandboxRepoDir(repo.name)
    },
    userData: { sandboxName: sandbox.name, repoName: repo.name, ...workspace }
  })
}
