import { runProcess } from '@orca/process-host'
import {
  CLOUD_DOCK_CLOSED_COMMAND,
  CLOUD_DOCK_SSH_OPTIONS
} from '../../shared/cloud/cloud-dock-line'
import { isShellProcess } from '../../shared/agent-status/process/shell-process-detection'

export type ProcessRow = { pid: number; ppid: number; args: string }

export function parseProcessTable(output: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (match) {
      rows.push({ pid: Number(match[1]), ppid: Number(match[2]), args: match[3].trim() })
    }
  }
  return rows
}

function isDockSsh(args: string, cloudDataFolder: string): boolean {
  return (
    /^(?:\S*\/)?ssh\s/.test(args) &&
    args.includes(`-t ${CLOUD_DOCK_SSH_OPTIONS} `) &&
    args.includes(cloudDataFolder)
  )
}

/** The shell a terminal runs, or the `login` that started it: not a program of anybody's. */
function isShellOrLogin(args: string): boolean {
  const name = (args.split(/\s+/)[0] ?? '').replace(/^-/, '')
  return isShellProcess(name) || /(?:^|\/)login$/.test(name)
}

/**
 * True when the program in a terminal is the app's own line for a cloud workspace's dock tab
 * (Setup, Run, its log follower, a numbered sandbox terminal): the ssh the dock started, with the
 * dock's options and a key or proxy from the app's cloud folder, or the `sleep` the tab's shell
 * becomes once that ssh ends. An ssh the person typed has neither the options nor the place, and
 * any other program beside the dock's line makes the terminal the person's.
 */
export function isOwnCloudDockProgram(
  rootPid: number,
  rows: readonly ProcessRow[],
  cloudDataFolder: string
): boolean {
  const root = rows.find((row) => row.pid === rootPid)
  if (!root) {
    return false
  }
  let ownProgram = false
  const pending = [root]
  for (let next = pending.pop(); next; next = pending.pop()) {
    const { pid, args } = next
    if (args === CLOUD_DOCK_CLOSED_COMMAND) {
      ownProgram = true
    } else if (isDockSsh(args, cloudDataFolder)) {
      // Its children are the proxy it reaches the sandbox through.
      ownProgram = true
      continue
    } else if (!isShellOrLogin(args)) {
      return false
    }
    pending.push(...rows.filter((row) => row.ppid === pid))
  }
  return ownProgram
}

const PROCESS_TABLE_TIMEOUT_MS = 1000

async function readProcessTable(): Promise<string> {
  const result = await runProcess({
    program: 'ps',
    args: ['-axo', 'pid=,ppid=,args='],
    timeoutMs: PROCESS_TABLE_TIMEOUT_MS,
    maxOutputBytes: 16 * 1024 * 1024
  })
  if (result.code !== 0 || result.timedOut || result.outputTruncated) {
    throw new Error('The process list could not be read')
  }
  return result.stdout
}

/**
 * The busy terminals Quit must not ask about, because the program in them is the app's own.
 * Without this, Quit said "2 terminals are running a program" whenever a cloud workspace's dock
 * was open. Empty when the process list cannot be read: asking once too often is the safe side.
 */
export async function ownCloudDockTerminalIds(
  terminals: readonly { id: string; rootProcessId?: number }[],
  cloudDataFolder: () => string,
  readTable: () => Promise<string> = readProcessTable,
  platform: NodeJS.Platform = process.platform
): Promise<Set<string>> {
  const own = new Set<string>()
  if (platform === 'win32' || terminals.every((terminal) => !terminal.rootProcessId)) {
    return own
  }
  try {
    const folder = cloudDataFolder()
    const rows = parseProcessTable(await readTable())
    for (const terminal of terminals) {
      if (terminal.rootProcessId && isOwnCloudDockProgram(terminal.rootProcessId, rows, folder)) {
        own.add(terminal.id)
      }
    }
  } catch {
    return new Set()
  }
  return own
}
