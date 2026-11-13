import { Sandbox } from '@vercel/sandbox'
import { z } from 'zod'
import type { BuiltinRecipeHandler } from '../../shared/ephemeral-vm-builtin-recipes'
import type { EphemeralVmRecipeContext } from '../../shared/ephemeral-vm-recipe-runner'
import type { ProcessRunResult } from '../../shared/ephemeral-vm-recipe-process'
import { currentSnapshot } from '../../shared/cloud/cloud-types'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'
import { forgetPinnedHostKey } from '../ssh/pinned-host-keys'
import { readVercelStatus, vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import {
  applyWorkspaceSandboxEnvironment,
  cloudSetupScriptContent,
  workspaceSandboxEnvironment
} from './cloud-sandbox-env'
import { sandboxRepoDir } from './cloud-base-image'
import { readCloudClaudeToken } from './cloud-claude-token'
import {
  GH_PLACEHOLDER_TOKEN,
  githubRepoOf,
  remoteBranchOfRef,
  sandboxNetworkPolicy
} from './cloud-github'
import { githubTokenForRepo } from './cloud-github-access'
import { readRepoFile } from './cloud-repo-store'
import { runSandboxScript } from './cloud-sandbox-run'
import { removeCloudMirror } from './cloud-mirror'
import { connectionResult, type CloudWorkspaceUserData } from './vercel-workspace-connection'
import {
  done,
  failed,
  isSandboxGone,
  cloudGitIdentity,
  networkOf,
  type Io
} from './vercel-workspace-io'
import { bestEffort, cloudInfo } from './cloud-log'
import { clearSandboxPending, markSandboxPending } from './cloud-pending-sandboxes'
import { retireSandbox } from './cloud-sandbox-retire'
import { afterCloudResume, writeCloudAgentActions } from './cloud-agent-actions'
import {
  SANDBOX_SSH_BRIDGE_PORT,
  removeWorkspaceKey,
  prepareWorkspaceKey
} from './cloud-ssh-access'
import { APT_OVER_HTTPS, markClaudeFirstRunDone } from './cloud-sandbox-prep-scripts'
import { CREATE_TIMEOUT_MS, extendToPlanLimit, readVercelLimits } from './cloud-session-length'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'
import { workspaceSandboxName } from './cloud-sandbox-name'
import {
  restoreCheckoutCommand,
  startWorkspaceSandbox,
  takeCloudRestore,
  workspaceFacts
} from './cloud-archive-restore'
import { importedWorkspaceStep } from './cloud-import-payload'

let repoIdForPath: (repoPath: string) => string | null = () => null

export function setCloudWorkspaceRepoResolver(next: (repoPath: string) => string | null): void {
  repoIdForPath = next
}

const UserDataSchema = z.object({
  sandboxName: z.string(),
  repoName: z.string(),
  branch: z.string().optional(),
  startCommit: z.string().optional()
})
const PayloadSchema = z.object({
  instanceId: z.string().optional(),
  recipeResult: z.object({ userData: UserDataSchema }).optional()
})

async function create(context: EphemeralVmRecipeContext, io: Io): Promise<ProcessRunResult> {
  // Recipes report progress on stderr; stdout carries only the result JSON.
  const log = (text: string): void => io.onStderr?.(text)
  // Phase durations, in the create log and Orca's main log, to see where a create's time goes.
  // The renderer's setup checklist advances on these lines (cloud-setup-steps.ts): keep the
  // phase names in sync with it.
  let phaseStart = Date.now()
  const timing = (phase: string): void => {
    const line = `create ${phase}: ${((Date.now() - phaseStart) / 1000).toFixed(1)} s`
    cloudInfo(line)
    log(`[cloud] ${line}\n`)
    phaseStart = Date.now()
  }
  const instanceId = context.instanceId
  const repoId = repoIdForPath(context.repoPath)
  if (!instanceId || !repoId) {
    return failed(
      new Error(`${FORK_PRODUCT_NAME} could not match this workspace to a repository.`),
      io
    )
  }
  const build = currentSnapshot(readRepoFile(repoId))
  if (!build?.snapshotId) {
    return failed(
      new Error('Build this repository for the cloud first: Settings, the repository, Cloud.'),
      io
    )
  }
  let sandbox: Sandbox | null = null
  const sandboxName = workspaceSandboxName(instanceId)
  try {
    const repo = await githubRepoOf(context.repoPath)
    if (!repo) {
      throw new Error('Cloud workspaces need a repository whose origin is on GitHub.')
    }
    const scope = await vercelScope()
    const status = await readVercelStatus()
    const limits = status.state === 'connected' ? status.limits : null
    const { config } = readRepoFile(repoId)
    const claudeToken = readCloudClaudeToken()
    const publicKey = await prepareWorkspaceKey(instanceId)
    log(
      `Starting a sandbox from the build of ${build.commit?.slice(0, 7) ?? 'the default branch'}\n`
    )
    const github = await githubTokenForRepo(repo)
    const restore = takeCloudRestore(repoId, context.branch)
    const createFrom = (snapshotId: string): Promise<Sandbox> =>
      Sandbox.create({
        ...scope,
        name: sandboxName,
        source: { type: 'snapshot', snapshotId },
        persistent: true,
        ports: [SANDBOX_SSH_BRIDGE_PORT],
        resources: {
          vcpus: Math.min(config.vcpus ?? limits?.defaultVcpus ?? 2, limits?.maxVcpus ?? 4)
        },
        timeout: CREATE_TIMEOUT_MS,
        networkPolicy: sandboxNetworkPolicy(repo, github, claudeToken, networkOf(config)),
        tags: { orca: 'workspace', repo: repoId },
        signal: io.signal
      })
    markSandboxPending(sandboxName)
    const started = await startWorkspaceSandbox(createFrom, build.snapshotId, restore, log)
    sandbox = started.sandbox
    log(`Sandbox ${sandbox.name}\n`)
    await extendToPlanLimit(sandbox, limits)
    timing('sandbox from snapshot')
    const facts = workspaceFacts(context.branch, restore?.commit ?? context.expectedRefHead)
    const result = await connectionResult(
      sandbox,
      instanceId,
      repo,
      log,
      publicKey,
      io.signal,
      facts
    )
    timing('ssh')

    const environment = workspaceSandboxEnvironment(
      repoId,
      claudeToken,
      github,
      GH_PLACEHOLDER_TOKEN
    )
    await applyWorkspaceSandboxEnvironment(sandbox, environment, io)
    if (claudeToken) {
      await markClaudeFirstRunDone(sandbox, undefined, io.signal)
    }
    if (networkOf(config).mode === 'allowlist') {
      // Vercel's allowlist only passes TLS, and Ubuntu's sources are plain http by default.
      await runSandboxScript(sandbox, APT_OVER_HTTPS, { sudo: true, signal: io.signal })
    }

    const dir = sandboxRepoDir(repo.name)
    const identity = await cloudGitIdentity(context.repoPath)
    const head = context.expectedRefHead ?? context.ref ?? 'HEAD'
    // -f: the only local changes in a fresh sandbox are the build's own output (an install can
    // write a lockfile the branch now tracks), which must not block the checkout.
    const fresh = context.branch
      ? `git checkout -q -f -B ${quotePosixShell(context.branch)} ${quotePosixShell(head)}`
      : `git checkout -q -f --detach ${quotePosixShell(head)}`
    const branch = restoreCheckoutCommand(restore, started.restored, context.branch, fresh)
    // The base branch's remote-tracking ref moves too; the build's copy is older, and Orca diffs the
    // workspace against it.
    const baseBranch = remoteBranchOfRef(context.ref)
    const trackingFetch = baseBranch
      ? `GIT_TERMINAL_PROMPT=0 git fetch --quiet origin ${quotePosixShell(`+refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`)} || true\n`
      : ''
    const imported = await importedWorkspaceStep(sandbox, restore?.importPayloadDir, dir, io.signal)
    log(`Checking out ${context.branch ?? head}\n`)
    await runSandboxScript(
      sandbox,
      `${identity.name ? `git config --global user.name ${quotePosixShell(identity.name)}\n` : ''}${identity.email ? `git config --global user.email ${quotePosixShell(identity.email)}\n` : ''}git config --global push.autoSetupRemote true
${trackingFetch}GIT_TERMINAL_PROMPT=0 git fetch --quiet origin ${quotePosixShell(head)} 2>/dev/null || GIT_TERMINAL_PROMPT=0 git fetch --quiet origin
${imported.beforeCheckout}${branch}`,
      { cwd: dir, signal: io.signal, onLog: log }
    )
    await imported.afterCheckout(log)

    if (config.setupScript.trim()) {
      // The workspace opens now; Orca runs this in the workspace's "Setup" terminal tab, where
      // its output stays visible (it used to block creation for about a minute).
      await sandbox.writeFiles(
        [
          {
            path: CLOUD_SETUP_SCRIPT_PATH,
            content: cloudSetupScriptContent(dir, config.setupScript),
            mode: 0o755
          }
        ],
        { signal: io.signal }
      )
    }
    await writeCloudAgentActions(sandbox, { id: repoId, path: context.repoPath }, dir, io.signal)
    timing('checkout')
    // Kept pending: the runtime record that names this sandbox is written from this result, and
    // the next start's sweep adopts it once that record exists.
    return done(result)
  } catch (error) {
    if (sandbox) {
      await sandbox
        .delete()
        .then(() => clearSandboxPending(sandboxName))
        .catch(bestEffort(`Deleting ${sandboxName} after a failed create (retried at next start)`))
    } else {
      clearSandboxPending(sandboxName)
    }
    removeWorkspaceKey(instanceId)
    forgetPinnedHostKey(instanceId)
    return failed(error, io)
  }
}

async function existing(stdin: string | undefined): Promise<{
  sandbox: Sandbox
  instanceId: string
  repoName: string
  workspace: CloudWorkspaceUserData
}> {
  const payload = PayloadSchema.parse(JSON.parse(stdin ?? '{}'))
  const userData = payload.recipeResult?.userData
  if (!payload.instanceId || !userData) {
    throw new Error('This cloud workspace has no sandbox on record.')
  }
  const sandbox = await Sandbox.get({ ...(await vercelScope()), name: userData.sandboxName })
  return {
    sandbox,
    instanceId: payload.instanceId,
    repoName: userData.repoName,
    workspace: workspaceFacts(userData.branch, userData.startCommit)
  }
}

async function resume(
  context: EphemeralVmRecipeContext,
  stdin: string | undefined,
  io: Io
): Promise<ProcessRunResult> {
  try {
    const { sandbox, instanceId, repoName, workspace } = await existing(stdin)
    const repoId = repoIdForPath(context.repoPath)
    const repo = (await githubRepoOf(context.repoPath)) ?? { owner: '', name: repoName }
    if (repo.owner && repoId) {
      // The GitHub token may have changed while the sandbox slept, and the repository's network
      // choice may have too; a resumed sandbox gets both fresh. A missing or expired token closes
      // GitHub (403) instead of keeping the workspace asleep.
      await sandbox.updateNetworkPolicy(
        sandboxNetworkPolicy(
          repo,
          await githubTokenForRepo(repo).catch(() => null),
          readCloudClaudeToken(),
          networkOf(readRepoFile(repoId).config)
        )
      )
    }
    await extendToPlanLimit(sandbox, await readVercelLimits())
    const result = await connectionResult(
      sandbox,
      instanceId,
      repo,
      (text) => io.onStderr?.(text),
      null,
      io.signal,
      workspace
    )
    if (repoId) {
      afterCloudResume(sandbox, { id: repoId, path: context.repoPath }, sandboxRepoDir(repoName))
    }
    return done(result)
  } catch (error) {
    return failed(error, io)
  }
}

/** Where a new workspace's cloud setup script waits for its "Setup" terminal tab. */
export const CLOUD_SETUP_SCRIPT_PATH = '/vercel/.orca-cloud-setup.sh'

export const vercelWorkspaceHandler: BuiltinRecipeHandler = async ({
  mode,
  context,
  stdin,
  ...io
}) => {
  switch (mode) {
    case 'create':
      return create(context, io)
    case 'resume':
      return resume(context, stdin, io)
    case 'suspend':
      try {
        await (await existing(stdin)).sandbox.stop()
        return done('')
      } catch (error) {
        return failed(error, io)
      }
    case 'destroy': {
      const instanceId = PayloadSchema.safeParse(JSON.parse(stdin ?? '{}')).data?.instanceId
      try {
        const { sandbox } = await existing(stdin)
        await retireSandbox(sandbox, await vercelScope())
      } catch (error) {
        // Deleted on Vercel already: still clear everything Orca keeps for it.
        if (!isSandboxGone(error)) {
          return failed(error, io)
        }
      }
      if (instanceId) {
        await removeCloudMirror(instanceId)
        removeWorkspaceKey(instanceId)
        forgetPinnedHostKey(instanceId)
      }
      return done('')
    }
  }
}
