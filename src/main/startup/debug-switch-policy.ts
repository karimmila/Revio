import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { durableWriteTempPath, writeFileDurableSync } from '../filesystem/durable-file-write'

/**
 * A packaged app must not hand itself to whoever starts it. Electron honours Chromium's remote
 * debugging switches and Node's inspector arguments by default, and either gives a local process
 * the app's windows, the person's sign-ins and a shell. A packaged build ignores them unless the
 * person turned on Settings › Advanced › "Allow debug tools". Development builds are not touched.
 */

/** Chromium switches that open the DevTools protocol to another process. */
export const REMOTE_DEBUGGING_SWITCHES = [
  'remote-debugging-port',
  'remote-debugging-pipe',
  'remote-debugging-address',
  'remote-debugging-targets',
  'remote-allow-origins'
] as const

/** Node arguments that start the main process's inspector. */
const NODE_INSPECTOR_ARGUMENT =
  /^--(?:inspect|inspect-brk|inspect-port|inspect-brk-node|inspect-publish-uid|debug|debug-brk|debug-port)(?:=|$)/

export type DebugSwitchesInArgv = {
  /** Names from REMOTE_DEBUGGING_SWITCHES that argv carries, without the dashes. */
  remoteDebugging: string[]
  /** Whether argv asks Node for its inspector. */
  nodeInspector: boolean
}

/** Reads argv only; every other switch, `--user-data-dir` among them, is left alone. */
export function findDebugSwitches(argv: readonly string[]): DebugSwitchesInArgv {
  const remoteDebugging = new Set<string>()
  let nodeInspector = false
  // The first entry is the executable, and everything after a bare `--` is not a switch.
  const end = argv.indexOf('--')
  for (const argument of argv.slice(1, end === -1 ? undefined : end)) {
    if (NODE_INSPECTOR_ARGUMENT.test(argument)) {
      nodeInspector = true
      continue
    }
    const name = /^--([a-z-]+)(?:=|$)/.exec(argument)?.[1]
    const known = REMOTE_DEBUGGING_SWITCHES.find((candidate) => candidate === name)
    if (known) {
      remoteDebugging.add(known)
    }
  }
  return { remoteDebugging: [...remoteDebugging], nodeInspector }
}

/**
 * The setting lives in the profile database, which cannot be opened before `ready`, while the
 * switches must go before `ready`. This small file carries the last saved answer to the next
 * launch; it is rewritten whenever the setting changes.
 */
export const DEBUG_TOOLS_MARKER_FILE = 'debug-tools.json'

export function readDebugToolsAllowedMarker(userDataPath: string): boolean {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(join(userDataPath, DEBUG_TOOLS_MARKER_FILE), 'utf8')
    )
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'allowDebugTools' in parsed &&
      parsed.allowDebugTools === true
    )
  } catch {
    // No file, or one that cannot be read: debug switches stay off.
    return false
  }
}

export function writeDebugToolsAllowedMarker(userDataPath: string, allowed: boolean): void {
  if (readDebugToolsAllowedMarker(userDataPath) === allowed) {
    return
  }
  try {
    const target = join(userDataPath, DEBUG_TOOLS_MARKER_FILE)
    writeFileDurableSync(
      durableWriteTempPath(target),
      target,
      `${JSON.stringify({ allowDebugTools: allowed })}\n`
    )
  } catch {
    // Best effort: without the file the next launch ignores debug switches, the safe answer.
  }
}

export type DebugSwitchPolicyHost = {
  isPackaged: boolean
  argv: readonly string[]
  debugToolsAllowed: boolean
  commandLine: { removeSwitch: (name: string) => void }
  closeInspector: () => void
  warn: (message: string) => void
}

/** Must run before `ready`: Chromium reads the remote debugging switches when it starts. */
export function applyDebugSwitchPolicy(host: DebugSwitchPolicyHost): DebugSwitchesInArgv | null {
  if (!host.isPackaged || host.debugToolsAllowed) {
    return null
  }
  const found = findDebugSwitches(host.argv)
  for (const name of found.remoteDebugging) {
    host.commandLine.removeSwitch(name)
  }
  if (found.nodeInspector) {
    host.closeInspector()
  }
  if (found.remoteDebugging.length > 0 || found.nodeInspector) {
    const names = [
      ...found.remoteDebugging.map((name) => `--${name}`),
      ...(found.nodeInspector ? ['--inspect'] : [])
    ]
    host.warn(
      `[startup] ignored ${names.join(', ')}: turn on Settings › Advanced › Allow debug tools, then start the app again`
    )
  }
  return found
}
