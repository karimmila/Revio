import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FORK_USER_DATA_DIR_NAME } from '../../shared/fork-identity'

const electron = vi.hoisted(() => ({
  switches: new Set<string>(),
  setPath: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'appData' ? '/tmp/app-data' : '')),
    setPath: electron.setPath,
    isPackaged: true,
    commandLine: {
      appendSwitch: vi.fn(),
      getSwitchValue: vi.fn(() => ''),
      hasSwitch: vi.fn((name: string) => electron.switches.has(name))
    }
  },
  shell: { openExternal: vi.fn() }
}))

describe('packaged userData folder', () => {
  beforeEach(() => {
    electron.switches.clear()
    electron.setPath.mockClear()
    vi.stubEnv('ORCA_E2E_USER_DATA_DIR', '')
  })

  it('uses the fork folder, not the "orca" folder a real Orca install owns', async () => {
    const { configureDevUserDataPath } = await import('./configure-process')
    configureDevUserDataPath(false)
    expect(electron.setPath).toHaveBeenCalledWith(
      'userData',
      join('/tmp/app-data', FORK_USER_DATA_DIR_NAME)
    )
  })

  it('keeps an explicit --user-data-dir', async () => {
    electron.switches.add('user-data-dir')
    const { configureDevUserDataPath } = await import('./configure-process')
    configureDevUserDataPath(false)
    expect(electron.setPath).not.toHaveBeenCalled()
  })
})
