import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEBUG_TOOLS_MARKER_FILE,
  applyDebugSwitchPolicy,
  findDebugSwitches,
  readDebugToolsAllowedMarker,
  writeDebugToolsAllowedMarker,
  type DebugSwitchPolicyHost
} from './debug-switch-policy'

const APP = '/Applications/App.app/Contents/MacOS/App'

describe('debug switches in argv', () => {
  it('finds remote debugging switches in every spelling', () => {
    expect(
      findDebugSwitches([
        APP,
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0',
        '--remote-allow-origins=*',
        '--remote-debugging-pipe'
      ])
    ).toEqual({
      remoteDebugging: [
        'remote-debugging-port',
        'remote-debugging-address',
        'remote-allow-origins',
        'remote-debugging-pipe'
      ],
      nodeInspector: false
    })
    expect(findDebugSwitches([APP, '--remote-debugging-port', '9222']).remoteDebugging).toEqual([
      'remote-debugging-port'
    ])
  })

  it.each([
    '--inspect',
    '--inspect=9229',
    '--inspect-brk',
    '--inspect-brk=127.0.0.1:9229',
    '--inspect-port=9229',
    '--inspect-brk-node',
    '--debug-port=5858'
  ])('finds the Node inspector argument %s', (argument) => {
    expect(findDebugSwitches([APP, argument]).nodeInspector).toBe(true)
  })

  it('leaves every other switch alone', () => {
    expect(
      findDebugSwitches([
        APP,
        '--user-data-dir=/tmp/profile',
        '--use-mock-keychain',
        '--serve',
        '--inspector-like-name',
        '--remote-debugging-portal=1',
        '/Users/someone/--remote-debugging-port=1'
      ])
    ).toEqual({ remoteDebugging: [], nodeInspector: false })
  })

  it('reads nothing after a bare --, and never the executable path', () => {
    expect(findDebugSwitches(['--inspect', '--', '--remote-debugging-port=9222'])).toEqual({
      remoteDebugging: [],
      nodeInspector: false
    })
  })
})

describe('debug switch policy', () => {
  const argv = [APP, '--user-data-dir=/tmp/profile', '--remote-debugging-port=9222', '--inspect']
  function host(overrides: Partial<DebugSwitchPolicyHost>) {
    const removed: string[] = []
    const closeInspector = vi.fn<() => void>()
    const warn = vi.fn<(message: string) => void>()
    const policyHost: DebugSwitchPolicyHost = {
      isPackaged: true,
      argv,
      debugToolsAllowed: false,
      commandLine: { removeSwitch: (name) => removed.push(name) },
      closeInspector,
      warn,
      ...overrides
    }
    return { policyHost, removed, closeInspector, warn }
  }

  it('removes the switches and closes the inspector in a packaged build', () => {
    const packaged = host({})
    applyDebugSwitchPolicy(packaged.policyHost)
    expect(packaged.removed).toEqual(['remote-debugging-port'])
    expect(packaged.closeInspector).toHaveBeenCalledOnce()
    expect(packaged.warn).toHaveBeenCalledWith(expect.stringContaining('Allow debug tools'))
  })

  it('keeps them when the person allowed debug tools', () => {
    const allowed = host({ debugToolsAllowed: true })
    expect(applyDebugSwitchPolicy(allowed.policyHost)).toBeNull()
    expect(allowed.removed).toEqual([])
    expect(allowed.closeInspector).not.toHaveBeenCalled()
  })

  it('never touches a development build', () => {
    const dev = host({ isPackaged: false })
    expect(applyDebugSwitchPolicy(dev.policyHost)).toBeNull()
    expect(dev.removed).toEqual([])
  })

  it('says nothing on an ordinary launch', () => {
    const plain = host({ argv: [APP, '--user-data-dir=/tmp/profile'] })
    applyDebugSwitchPolicy(plain.policyHost)
    expect(plain.removed).toEqual([])
    expect(plain.warn).not.toHaveBeenCalled()
  })
})

describe('debug tools marker', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'debug-tools-marker-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('is off until the setting is saved on, and follows it back off', () => {
    expect(readDebugToolsAllowedMarker(root)).toBe(false)
    writeDebugToolsAllowedMarker(root, true)
    expect(readDebugToolsAllowedMarker(root)).toBe(true)
    writeDebugToolsAllowedMarker(root, false)
    expect(readDebugToolsAllowedMarker(root)).toBe(false)
  })

  it('reads a damaged or foreign file as off', () => {
    for (const contents of ['', 'true', '{"allowDebugTools":"yes"}', '[true]']) {
      writeFileSync(join(root, DEBUG_TOOLS_MARKER_FILE), contents)
      expect(readDebugToolsAllowedMarker(root)).toBe(false)
    }
  })
})
