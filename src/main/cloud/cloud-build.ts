import { randomUUID } from 'node:crypto'
import { Sandbox, Snapshot } from '@vercel/sandbox'
import {
  CLOUD_BASE_LAYER_VERSION,
  type CloudBuild,
  type CloudBuildEvent
} from '../../shared/cloud/cloud-types'
import { sandboxScriptEnv } from './cloud-sandbox-env'
import { readVercelStatus, vercelScope } from '../vercel-cloud/vercel-cloud-auth'
import { BASE_PROVISION_SCRIPT, sandboxRepoDir } from './cloud-base-image'
import { cloneUrl, GH_PLACEHOLDER_TOKEN, githubRepoOf, sandboxNetworkPolicy } from './cloud-github'
import { bakeOrcadIntoSandbox } from './cloud-orcad-bake'
import { githubTokenForRepo } from './cloud-github-access'
import { appendBuildLog, readRepoFile, saveCloudBuild } from './cloud-repo-store'
import { runSandboxScript } from './cloud-sandbox-run'
import { humanCloudError, redactSecrets } from './cloud-errors'
import { retireSandbox } from './cloud-sandbox-retire'
import { SNAPSHOT_SCRUB_SCRIPT } from './cloud-snapshot-scrub'
import { bestEffort } from './cloud-log'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

type Emit = (event: CloudBuildEvent) => void

const running = new Map<string, AbortController>()

export function isCloudBuildRunning(repoId: string): boolean {
  return running.has(repoId)
}

export function cancelCloudBuild(repoId: string): void {
  running.get(repoId)?.abort()
}

/**
 * Builds the snapshot a repository's cloud workspaces start from: a fresh sandbox, Orca's base
 * tools, the repository's default branch, then the install script. Runs in the background; the
 * returned build is its first state and every later change arrives through `emit`.
 */
export function startCloudBuild(repoId: string, repoPath: string, emit: Emit): CloudBuild {
  if (running.has(repoId)) {
    throw new Error('A build is already running for this repository.')
  }
  const abort = new AbortController()
  running.set(repoId, abort)
  let build: CloudBuild = {
    id: randomUUID(),
    state: 'running',
    step: 'Starting',
    startedAt: Date.now(),
    finishedAt: null,
    commit: null,
    snapshotId: null,
    error: null
  }
  const update = (patch: Partial<CloudBuild>, log = ''): void => {
    build = { ...build, ...patch }
    saveCloudBuild(repoId, build)
    if (log) {
      appendBuildLog(build.id, log)
    }
    emit({ repoId, build, log })
  }
  const log = (raw: string): void => {
    const text = redactSecrets(raw)
    appendBuildLog(build.id, text)
    emit({ repoId, build, log: text })
  }
  update({})
  void runBuild(repoId, repoPath, abort.signal, update, log)
    .catch((error: unknown) => {
      const message = humanCloudError(error, 'build')
      update(
        {
          state: abort.signal.aborted ? 'canceled' : 'failed',
          error: abort.signal.aborted ? null : message,
          finishedAt: Date.now()
        },
        `\n${abort.signal.aborted ? 'Canceled' : `Failed: ${message}`}\n`
      )
    })
    .finally(() => running.delete(repoId))
  return build
}

async function runBuild(
  repoId: string,
  repoPath: string,
  signal: AbortSignal,
  update: (patch: Partial<CloudBuild>, log?: string) => void,
  log: (text: string) => void
): Promise<void> {
  const scope = await vercelScope()
  const status = await readVercelStatus()
  const limits = status.state === 'connected' ? status.limits : null
  const repo = await githubRepoOf(repoPath)
  if (!repo) {
    throw new Error('Cloud workspaces need a repository whose origin is on GitHub.')
  }
  const github = await githubTokenForRepo(repo)
  const { config } = readRepoFile(repoId)
  const vcpus = Math.min(config.vcpus ?? limits?.defaultVcpus ?? 2, limits?.maxVcpus ?? 4)
  const timeoutMinutes = Math.min(limits?.maxSessionMinutes ?? 45, 45)
  update({ step: 'Starting a sandbox' }, `Starting a ${vcpus} vCPU sandbox in ${scope.teamId}\n`)
  const sandbox = await Sandbox.create({
    ...scope,
    resources: { vcpus },
    timeout: timeoutMinutes * 60 * 1000,
    // Builds stay open: install scripts fetch toolchains from wherever their projects publish
    // them (go.dev, nodejs.org, temporal.download, container registries), which no fixed list
    // covers. The build gets no Claude token, a read-only GitHub token, and only the repo's
    // default branch; nothing a workspace creates runs here.
    networkPolicy: sandboxNetworkPolicy(
      repo,
      github,
      null,
      { mode: 'open', extraDomains: [] },
      { readOnly: true }
    ),
    tags: { orca: 'build', repo: repoId },
    signal
  })
  try {
    log(`Sandbox ${sandbox.name}\n`)
    update(
      { step: `Installing ${FORK_PRODUCT_NAME}'s base tools` },
      `\n== Installing ${FORK_PRODUCT_NAME}'s base tools\n`
    )
    await runSandboxScript(sandbox, BASE_PROVISION_SCRIPT, { sudo: true, signal, onLog: log })

    const dir = sandboxRepoDir(repo.name)
    update({ step: `Cloning ${repo.owner}/${repo.name}` }, `\n== Cloning into ${dir}\n`)
    await runSandboxScript(
      sandbox,
      `GIT_TERMINAL_PROMPT=0 git clone --quiet ${cloneUrl(repo)} ${dir} && git -C ${dir} log --oneline -1`,
      { signal, onLog: log }
    )
    const commit = (
      await (
        await sandbox.runCommand({ cmd: 'git', args: ['-C', dir, 'rev-parse', 'HEAD'] })
      ).stdout()
    ).trim()
    update({ commit })

    if (config.installScript.trim()) {
      update({ step: 'Running the install script' }, '\n== Running the install script\n')
      await runSandboxScript(sandbox, config.installScript, {
        cwd: dir,
        env: {
          ...sandboxScriptEnv(repoId),
          GH_TOKEN: GH_PLACEHOLDER_TOKEN
        },
        signal,
        onLog: log
      })
    }

    update(
      { step: `Installing ${FORK_PRODUCT_NAME}'s server` },
      `\n== Installing ${FORK_PRODUCT_NAME}'s server\n`
    )
    // Non-fatal: without it the first connect of each workspace uploads the server (~90 s).
    await bakeOrcadIntoSandbox(sandbox, { signal, log }).catch((error: unknown) =>
      log(`Skipped (the first connect will upload it): ${humanCloudError(error)}\n`)
    )
    // Smaller snapshots restore faster and count less against the plan's storage.
    await runSandboxScript(
      sandbox,
      'sudo apt-get clean; sudo rm -rf /tmp/* /var/tmp/* /var/log/*.gz 2>/dev/null; true',
      { signal }
    )
    await runSandboxScript(sandbox, SNAPSHOT_SCRUB_SCRIPT, { cwd: dir, signal, onLog: log })

    update({ step: 'Saving the snapshot' }, '\n== Saving the snapshot\n')
    const snapshot = await sandbox.snapshot({ expiration: 0, signal })
    await deleteOlderSnapshots(repoId, scope)
    update(
      {
        state: 'succeeded',
        step: 'Ready',
        snapshotId: snapshot.snapshotId,
        baseLayer: CLOUD_BASE_LAYER_VERSION,
        finishedAt: Date.now()
      },
      `Snapshot ${snapshot.snapshotId}\nReady\n`
    )
  } finally {
    // Sandboxes are persistent by default; a stopped build sandbox would keep its disk forever.
    await retireSandbox(sandbox, scope, { keepSnapshots: true }).catch(
      bestEffort(`Deleting build sandbox ${sandbox.name}`)
    )
  }
}

/** One snapshot per repository: the new build replaces the last. New workspaces copy it, so
 * deleting an old one never touches a workspace that already started from it. */
async function deleteOlderSnapshots(
  repoId: string,
  scope: { token: string; teamId: string; projectId: string }
): Promise<void> {
  for (const old of readRepoFile(repoId).builds) {
    if (!old.snapshotId) {
      continue
    }
    try {
      await (await Snapshot.get({ ...scope, snapshotId: old.snapshotId })).delete()
    } catch {
      // Already gone or expired.
    }
    saveCloudBuild(repoId, { ...old, snapshotId: null })
  }
}
