import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rename } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { runProcess } from '@orca/process-host'
import { cloneMacTree } from '../../../filesystem/macos-tree-clone'
import { FORK_TERMINAL_HOST_HELPER_NAME } from '../../../../shared/fork-identity'
import { rm } from '../../../filesystem/asar-transparent-fs'
import { ensurePrivateDir } from '../../endpoint/publication/daemon-private-file-modes'
import { inspectMacProcessCodeIdentity } from './daemon-mac-code-identity'

/** Plain Node helper packaged by config/scripts/macos-terminal-host-bundle.cjs. */
export const MAC_TERMINAL_HOST_BUNDLE = `${FORK_TERMINAL_HOST_HELPER_NAME}.app`
export const MAC_TERMINAL_HOST_EXECUTABLE = 'orca-terminal-host'
export const MAC_DAEMON_COPY_PREFIX = 'terminal-host-'

export type MacDaemonBundle = {
  directory: string
  execPath: string
  entryPath: string
}

/** Keep signed copies outside paths replaced by the updater. */
export function getMacDaemonBundleRoot(userDataPath: string): string {
  return join(userDataPath, 'daemon-host', 'macos')
}

/** .noindex suppresses Spotlight indexing; direct execution can still register with LaunchServices. */
export function macDaemonCopyBundlePath(directory: string): string {
  return join(directory, 'app.noindex', MAC_TERMINAL_HOST_BUNDLE)
}

function describeCopy(directory: string): MacDaemonBundle {
  const contents = join(macDaemonCopyBundlePath(directory), 'Contents')
  return {
    directory,
    execPath: join(contents, 'MacOS', MAC_TERMINAL_HOST_EXECUTABLE),
    entryPath: join(contents, 'Resources', 'daemon', 'out', 'main', 'daemon-entry.js')
  }
}

function appBundleForMainExecutable(executable: string): string {
  const bundle = resolve(dirname(executable), '..', '..')
  if (
    !isAbsolute(executable) ||
    !bundle.endsWith('.app') ||
    dirname(executable) !== join(bundle, 'Contents', 'MacOS')
  ) {
    throw new Error('The running macOS process is not an app bundle executable')
  }
  return bundle
}

/**
 * The build has no signing identity: its designated requirement is its own code hash, which only
 * the app's main executable satisfies. The helper can then never be tied to the app, so the
 * caller runs terminals from the app itself. Expected on every launch of such a build.
 */
export class MacTerminalHostAdHocSignatureError extends Error {
  constructor() {
    super('The app is ad-hoc signed, so the macOS terminal host cannot share its signature')
    this.name = 'MacTerminalHostAdHocSignatureError'
  }
}

const DESIGNATED_PREFIX = 'designated => '

/**
 * codesign prints an explicit requirement as `designated => …` and one it derived itself, as for
 * an ad-hoc signed app, as `# designated => …`. Both name the requirement the app is held to, so
 * both are read; what decides the outcome is the requirement, never how it was printed.
 */
export function parseDesignatedRequirement(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const text = line.startsWith('# ') ? line.slice(2) : line
    if (text.startsWith(DESIGNATED_PREFIX)) {
      return text.slice(DESIGNATED_PREFIX.length).trim() || null
    }
  }
  return null
}

/** True for a requirement that names one code hash and no signing identity. */
export function isCodeHashOnlyRequirement(requirement: string): boolean {
  return /^cdhash H"[0-9a-f]+"$/i.test(requirement)
}

// codesign display fields normally arrive on stderr.
async function readCodesignOutput(
  args: string[],
  field: string,
  signal: AbortSignal
): Promise<string> {
  const result = await runProcess({
    program: '/usr/bin/codesign',
    args,
    timeoutMs: 5_000,
    maxOutputBytes: 64 * 1024,
    signal
  })
  if (result.code !== 0 || result.timedOut || result.outputTruncated) {
    throw new Error(`Could not read ${field} from codesign`)
  }
  return `${result.stderr}\n${result.stdout}`
}

async function readCodesignField(
  args: string[],
  prefix: string,
  signal: AbortSignal
): Promise<string> {
  const line = (await readCodesignOutput(args, prefix.trim(), signal))
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(prefix))
  if (!line) {
    throw new Error(`Could not read ${prefix.trim()} from codesign`)
  }
  return line.slice(prefix.length)
}

async function readDesignatedRequirement(appBundle: string, signal: AbortSignal): Promise<string> {
  const field = DESIGNATED_PREFIX.trim()
  const requirement = parseDesignatedRequirement(
    await readCodesignOutput(['--display', '-r-', appBundle], field, signal)
  )
  if (!requirement) {
    throw new Error(`Could not read ${field} from codesign`)
  }
  return requirement
}

export async function materializeMacDaemonBundle(
  root: string,
  signal: AbortSignal
): Promise<MacDaemonBundle> {
  // After an update, process.execPath may name the new bundle instead of the running one.
  const running = await inspectMacProcessCodeIdentity(process.pid)
  if (!running.executablePath) {
    throw new Error('Could not resolve the running macOS app bundle')
  }
  const appBundle = await realpath(appBundleForMainExecutable(running.executablePath))
  const source = join(appBundle, 'Contents', 'Helpers', MAC_TERMINAL_HOST_BUNDLE)
  const cdhash = await readCodesignField(['-dvvv', source], 'CDHash=', signal)
  if (!/^[0-9a-f]{40,64}$/.test(cdhash)) {
    throw new Error('The macOS terminal host has an unexpected CDHash')
  }
  const name = `${MAC_DAEMON_COPY_PREFIX}${cdhash}`
  const copy = describeCopy(join(root, name))
  // Only verified copies are published, so later launches can reuse them without re-verification.
  if (existsSync(copy.directory)) {
    return copy
  }
  // Matching the running app’s designated requirement preserves its privacy grants.
  const requirement = await readDesignatedRequirement(appBundle, signal)
  // Read before anything is copied: no copy can satisfy a code-hash requirement, and cloning the
  // helper on every launch only to reject it would be wasted work.
  if (isCodeHashOnlyRequirement(requirement)) {
    throw new MacTerminalHostAdHocSignatureError()
  }
  ensurePrivateDir(root)
  // The PID keeps our collector from deleting an in-progress staging copy.
  const staging = await mkdtemp(join(root, `${name}.staging-${process.pid}-`))
  try {
    const stagedBundle = macDaemonCopyBundlePath(staging)
    await mkdir(dirname(stagedBundle))
    await cloneMacTree(source, stagedBundle, signal)
    const verified = await runProcess({
      program: '/usr/bin/codesign',
      args: ['--verify', '--strict', '-R', `=${requirement}`, stagedBundle],
      maxOutputBytes: 8192,
      signal
    })
    if (verified.code !== 0 || verified.timedOut) {
      throw new Error("The macOS terminal host copy does not satisfy the app's signature")
    }
    await rename(staging, copy.directory).catch((error: unknown) => {
      // A competing publisher verified the same helper before publishing.
      if (!existsSync(copy.directory)) {
        throw error
      }
    })
    return copy
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
  }
}
