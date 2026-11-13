import { describe, expect, it, vi } from 'vitest'
import {
  CLOUD_DOCK_CLOSED_COMMAND,
  CLOUD_DOCK_SSH_OPTIONS
} from '../../shared/cloud/cloud-dock-line'

vi.mock('../i18n/main-i18n', () => ({
  translateMain: (_key: string, fallback: string) => fallback
}))

import {
  isOwnCloudDockProgram,
  ownCloudDockTerminalIds,
  parseProcessTable
} from './quit-own-terminal-programs'
import { countBusyTerminals } from './quit-terminal-policy'

const CLOUD = '/Users/me/Library/Application Support/Revio/cloud'
const DOCK_SSH = `ssh -t ${CLOUD_DOCK_SSH_OPTIONS} -p 2222 -i ${CLOUD}/keys/sbx_1 -o ProxyCommand=node ${CLOUD}/wsproxy.mjs wss://x ubuntu@sandbox cd /vercel/repo; pnpm dev; exec bash -l`

// What `ps -axo pid=,ppid=,args=` prints; 100, 200, 300, 400 and 500 are terminals' shells.
const TABLE = `
  100     1 -zsh
  101   100 ${DOCK_SSH}
  102   101 node ${CLOUD}/wsproxy.mjs wss://x
  200     1 ${CLOUD_DOCK_CLOSED_COMMAND}
  300     1 -zsh
  301   300 ssh me@my-server.example.com
  400     1 -zsh
  401   400 node server.js
  500     1 -zsh
  501   500 ssh -p 2222 -i ${CLOUD}/keys/sbx_1 ubuntu@sandbox
  600     1 -zsh
  700     1 login -pfl me /bin/zsh -l
  701   700 -zsh
  702   701 ${DOCK_SSH}
  800     1 login -pfl me /bin/zsh -l
  801   800 ${CLOUD_DOCK_CLOSED_COMMAND}
  900     1 -zsh
  901   900 ${DOCK_SSH}
  902   900 node watch.js
`
const rows = parseProcessTable(TABLE)

describe('the app’s own cloud dock programs', () => {
  it('reads pids, parents and whole command lines', () => {
    expect(rows).toHaveLength(19)
    expect(rows[1]).toEqual({ pid: 101, ppid: 100, args: DOCK_SSH })
  })

  it('knows the dock’s ssh line and the sleep its tab ends in', () => {
    expect(isOwnCloudDockProgram(100, rows, CLOUD)).toBe(true)
    expect(isOwnCloudDockProgram(200, rows, CLOUD)).toBe(true)
  })

  it('looks through the login and the shell a terminal starts with', () => {
    expect(isOwnCloudDockProgram(700, rows, CLOUD)).toBe(true)
    expect(isOwnCloudDockProgram(800, rows, CLOUD)).toBe(true)
  })

  it('leaves the person’s programs alone, also an ssh they typed', () => {
    expect(isOwnCloudDockProgram(300, rows, CLOUD)).toBe(false)
    expect(isOwnCloudDockProgram(400, rows, CLOUD)).toBe(false)
    // "Copy SSH command", pasted into a terminal: the app's key, but not the dock's line.
    expect(isOwnCloudDockProgram(500, rows, CLOUD)).toBe(false)
    expect(isOwnCloudDockProgram(600, rows, CLOUD)).toBe(false)
    expect(isOwnCloudDockProgram(999, rows, CLOUD)).toBe(false)
    // A program of theirs beside the dock's line keeps the terminal theirs.
    expect(isOwnCloudDockProgram(900, rows, CLOUD)).toBe(false)
  })

  it('names the terminals to leave out, and none when the process list cannot be read', async () => {
    const terminals = [
      { id: 'setup', rootProcessId: 100 },
      { id: 'closed-run', rootProcessId: 200 },
      { id: 'server', rootProcessId: 400 },
      { id: 'no-pid' }
    ]
    const read = async (): Promise<string> => TABLE
    expect(await ownCloudDockTerminalIds(terminals, () => CLOUD, read, 'darwin')).toEqual(
      new Set(['setup', 'closed-run'])
    )
    const failing = async (): Promise<string> => {
      throw new Error('ps failed')
    }
    expect(await ownCloudDockTerminalIds(terminals, () => CLOUD, failing, 'darwin')).toEqual(
      new Set()
    )
    expect(await ownCloudDockTerminalIds(terminals, () => CLOUD, read, 'win32')).toEqual(new Set())
  })
})

describe('busy terminals at quit', () => {
  const source = {
    listProcesses: async () => [
      { id: 'setup', rootProcessId: 100 },
      { id: 'closed-run', rootProcessId: 200 },
      { id: 'server', rootProcessId: 400 },
      { id: 'shell', rootProcessId: 600 }
    ],
    hasChildProcesses: async (id: string) => id !== 'shell'
  }
  const own = (busy: readonly { id: string; rootProcessId?: number }[]) =>
    ownCloudDockTerminalIds(
      busy,
      () => CLOUD,
      async () => TABLE,
      'darwin'
    )

  it('does not count a cloud workspace’s dock sessions as programs the person runs', async () => {
    expect(await countBusyTerminals(source, 1000)).toBe(3)
    expect(await countBusyTerminals(source, 1000, own)).toBe(1)
  })

  it('asks about nothing when only the app’s own sessions are busy', async () => {
    const onlyOwn = {
      ...source,
      hasChildProcesses: async (id: string) => id !== 'server' && id !== 'shell'
    }
    expect(await countBusyTerminals(onlyOwn, 1000, own)).toBe(0)
  })

  it('counts every busy terminal when the own-session check fails', async () => {
    const failing = async (): Promise<ReadonlySet<string>> => {
      throw new Error('ps failed')
    }
    expect(await countBusyTerminals(source, 1000, failing)).toBe(3)
  })
})
