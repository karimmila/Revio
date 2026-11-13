import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import type { Sandbox } from '@vercel/sandbox'
import { getAppEnvironment } from '../../shared/app-environment'
import { pinnedNodeRuntimeAsset, nodeRuntimeExecutablePath } from '../../shared/node-runtime-pin'
import {
  ORCAD_INSTALL_COMPLETE_FILENAME,
  ORCAD_NODE_RUNTIME_DIR_PREFIX,
  ORCAD_RUNTIMES_DIRNAME
} from '../../shared/orcad-artifacts'
import { quotePosixShell } from '../../shared/shell/launch/shell-argument-quoting'
import { REMOTE_NODE_RUNTIME_VERIFIED_MARKER } from '../ssh/orcad-remote-node-runtime-report'
import { ORCAD_INSTALL_MODEL } from '../managed-server/install/remote-install-model'
import {
  computeRemoteInstallDir,
  readLocalFullVersion
} from '../managed-server/install/remote-versioned-install'
import { materializeOrcadArtifact } from '../orcad/orcad-artifact-materializer'
import { materializeNodeRuntimeArchive } from '../node-runtime/pinned-runtime-materializer'
import { resolveSelectedLocalCommand } from '../ipc/command-path/command-path-resolver'
import { runSandboxScript } from './cloud-sandbox-run'
import { FORK_PRODUCT_NAME } from '../../shared/fork-identity'

const SANDBOX_HOME = '/vercel'
// Finder and AppleDouble metadata from the Mac that packs the slot; none of it belongs on Linux.
export const BAKE_TAR_EXCLUDES = ['--exclude=._*', '--exclude=.DS_Store', '--exclude=.AppleDouble']
const TARGET = 'linux-x64-glibc'

/**
 * Lays Orca's server for this build into the snapshot, in the layout and with the markers its
 * SSH deploy leaves (`.orca-remote/orcad-<version>/.install-complete`, the pinned Node runtime
 * with `.verified`). A new workspace's first connect then finds both and skips the upload, which
 * took ~90 s through the SSH bridge (seen in an e2e create). The bytes come from the same
 * local template and pinned runtime archive the deploy would send; the deploy's own checks still
 * run against them.
 */
export async function bakeOrcadIntoSandbox(
  sandbox: Sandbox,
  options: { signal?: AbortSignal; log?: (text: string) => void } = {}
): Promise<string> {
  const localOrcadDir = await materializeOrcadArtifact(TARGET, { signal: options.signal })
  const fullVersion = readLocalFullVersion(localOrcadDir)
  const cacheRoot = join(getAppEnvironment().getPath('userData'), 'orcad-artifacts')
  const archive = await materializeNodeRuntimeArchive(TARGET, cacheRoot, {
    signal: options.signal
  })
  const asset = pinnedNodeRuntimeAsset(TARGET)
  const member = nodeRuntimeExecutablePath(TARGET, asset.archive)
  const slot = computeRemoteInstallDir(ORCAD_INSTALL_MODEL, SANDBOX_HOME, fullVersion)
  const runtime = `${SANDBOX_HOME}/.orca-remote/${ORCAD_RUNTIMES_DIRNAME}/${ORCAD_NODE_RUNTIME_DIR_PREFIX}${asset.executableSha256}`

  // One gzip of the slot, made with the system tar (symlinks and modes kept).
  const slotArchive = join(cacheRoot, `bake-${fullVersion}.tgz`)
  const tar = await runProcess({
    program: resolveSelectedLocalCommand('tar', { env: process.env }),
    args: ['-czf', slotArchive, ...BAKE_TAR_EXCLUDES, '-C', localOrcadDir, '.'],
    // macOS tar otherwise stores extended attributes as `._name` files beside each entry.
    env: { ...process.env, COPYFILE_DISABLE: '1' },
    timeoutMs: 120_000,
    maxOutputBytes: 64 * 1024
  })
  if (tar.code !== 0) {
    throw new Error(`Could not pack ${FORK_PRODUCT_NAME}'s server: ${tar.stderr.trim()}`)
  }
  options.log?.(`Laying ${FORK_PRODUCT_NAME}'s server ${fullVersion} into the snapshot\n`)
  await sandbox.writeFiles(
    [
      { path: '/tmp/orca-bake/slot.tgz', content: readFileSync(slotArchive) },
      { path: '/tmp/orca-bake/node.tgz', content: readFileSync(archive) }
    ],
    { signal: options.signal }
  )
  const q = quotePosixShell
  await runSandboxScript(
    sandbox,
    `set -euo pipefail
mkdir -p ${q(slot)} ${q(`${runtime}/bin`)}
tar -xzf /tmp/orca-bake/slot.tgz -C ${q(slot)}
: > ${q(`${slot}/${ORCAD_INSTALL_COMPLETE_FILENAME}`)}
cd /tmp/orca-bake && tar -xzf node.tgz ${q(member)}
[ "$(sha256sum ${q(member)} | cut -d' ' -f1)" = ${q(asset.executableSha256)} ]
install -m 755 ${q(member)} ${q(`${runtime}/bin/node`)}
: > ${q(`${runtime}/${REMOTE_NODE_RUNTIME_VERIFIED_MARKER}`)}
rm -rf /tmp/orca-bake
echo "${FORK_PRODUCT_NAME} server ready: $(${q(`${runtime}/bin/node`)} --version)"`,
    { signal: options.signal, onLog: options.log }
  )
  return fullVersion
}
