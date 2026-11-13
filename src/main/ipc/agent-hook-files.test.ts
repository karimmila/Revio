import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }))

import { listManagedHookFiles } from './agent-hook-files'

describe('listManagedHookFiles', () => {
  it('names only the files that hold hook entries', () => {
    expect(
      listManagedHookFiles([
        {
          agent: 'claude',
          state: 'installed',
          configPath: '/Users/me/.claude/settings.json',
          managedHooksPresent: true,
          detail: null
        },
        {
          agent: 'gemini',
          state: 'not_installed',
          configPath: '/Users/me/.gemini/settings.json',
          managedHooksPresent: false,
          detail: null
        },
        {
          agent: 'codex',
          state: 'skipped',
          configPath: '',
          managedHooksPresent: false,
          detail: null
        }
      ])
    ).toEqual(['/Users/me/.claude/settings.json'])
  })
})
