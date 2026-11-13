import { closeTestStores, testState, createStore, writeDataFile } from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LEGACY_NAME } from '../../shared/legacy-name-migration'

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  }
}))

describe('Store legacy-name settings', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('loads settings saved under the legacy names under the new names', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {
        [`${LEGACY_NAME}Layout`]: false,
        [`${LEGACY_NAME}Location`]: 'cloud',
        [`${LEGACY_NAME}DebugTools`]: true,
        [`${LEGACY_NAME}SidebarSections`]: [{ id: 's1', name: 'Mine' }],
        [`${LEGACY_NAME}WorkspaceSections`]: { w1: 's1' }
      },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const settings = (await createStore()).getSettings()
    expect(settings).toMatchObject({
      revioLayout: false,
      revioLocation: 'cloud',
      revioDebugTools: true,
      revioSidebarSections: [{ id: 's1', name: 'Mine' }],
      revioWorkspaceSections: { w1: 's1' }
    })
    expect(Object.keys(settings).filter((key) => key.startsWith(LEGACY_NAME))).toEqual([])
  })
})
